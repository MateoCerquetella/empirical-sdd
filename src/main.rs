use std::collections::BTreeSet;
use std::fs;
use std::io::{self, Read};
use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use empirical_sdd::{
    Capability, CommandAdapter, ControlMode, DeliveryAuthority, DeliveryProvider, EvidenceRecord,
    EvidenceStore, GitHubDelivery, InitOptions, LoopEngine, NewSpecOptions, Phase, PhaseAdapter,
    PhaseContext, PhaseResult, Profile, Result, RunStop, SddError, SddRepository,
    copy_evidence_artifact, create_spec, default_user_home, initialize, required_capabilities,
    sync_agent_packs, upgrade_kit, workspace_hash,
};
use serde::Serialize;
use serde_json::json;

#[derive(Debug, Parser)]
#[command(
    name = "empirical",
    version,
    about = "Portable, evidence-backed Spec-Driven Development"
)]
struct Cli {
    /// Repository path or any directory below it.
    #[arg(long, global = true, default_value = ".")]
    root: PathBuf,

    /// Emit machine-readable JSON.
    #[arg(long, global = true)]
    json: bool,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// Create the neutral ai/ starter in a new or existing project.
    Init {
        #[arg(long, default_value = "quick")]
        profile: Profile,
        #[arg(long, default_value = "autonomous")]
        mode: ControlMode,
        #[arg(long, default_value = "empirical-init")]
        actor: String,
    },
    /// Non-destructively add the resumable protocol to an Empirical v1 project.
    Adopt {
        #[arg(long)]
        profile: Option<Profile>,
        #[arg(long, default_value = "empirical-adopt")]
        actor: String,
    },
    /// Show the active spec, phase, revision, profile, and stop condition.
    Status,
    /// Create and select a feature spec from the neutral template.
    New {
        spec_id: String,
        #[arg(long)]
        title: Option<String>,
        #[arg(long)]
        profile: Option<Profile>,
        #[arg(long, default_value = "empirical-new")]
        actor: String,
    },
    /// Select an existing spec directory and start its profile sequence.
    Select {
        spec_id: String,
        #[arg(long)]
        profile: Option<Profile>,
        #[arg(long)]
        expected_revision: Option<u64>,
        #[arg(long, default_value = "empirical-select")]
        actor: String,
    },
    /// Report the next phase and capabilities without invoking an adapter.
    Next {
        #[arg(long, default_value = "empirical-next")]
        actor: String,
    },
    /// Continue automatically using command adapters from ai/empirical.toml.
    #[command(alias = "run")]
    Loop {
        /// Permit configured adapter programs to execute for this invocation.
        #[arg(long)]
        allow_exec: bool,
        #[arg(long, default_value = "empirical-loop")]
        actor: String,
    },
    /// Apply a typed phase result produced by any external client.
    CheckIn {
        #[arg(long)]
        result: PathBuf,
        #[arg(long)]
        expected_revision: u64,
        #[arg(long, default_value = "external-client")]
        actor: String,
    },
    /// Continue a HITL workflow after a required human decision.
    Approve {
        #[arg(long)]
        expected_revision: u64,
        #[arg(long)]
        actor: String,
    },
    /// Resume a blocked workflow after its reported blocker is resolved.
    Retry {
        #[arg(long)]
        expected_revision: u64,
        #[arg(long, default_value = "empirical-retry")]
        actor: String,
    },
    /// Add, copy, or validate criterion-bound evidence.
    Evidence {
        #[command(subcommand)]
        command: EvidenceCommands,
    },
    /// Evaluate the current evidence gate.
    Validate,
    /// Rebuild STATE.md from the portable event journal.
    Recover,
    /// Check state, config, specs, events, and configured adapter programs.
    Doctor,
    /// Check or safely update Empirical-managed repository playbooks and templates.
    Upgrade {
        /// Report available updates without writing files.
        #[arg(long)]
        check: bool,
    },
    /// Manage the global Empirical command packs installed for every supported agent.
    Agents {
        #[command(subcommand)]
        command: AgentCommands,
    },
    /// Run configured Git/GitHub delivery with explicit invocation authority.
    Deliver {
        #[arg(long)]
        allow_commit: bool,
        #[arg(long)]
        allow_push: bool,
        #[arg(long)]
        allow_pull_request: bool,
        #[arg(long, default_value = "empirical-delivery")]
        actor: String,
    },
}

#[derive(Debug, Subcommand)]
enum EvidenceCommands {
    /// Add one evidence record or a JSON array of records.
    Add { file: PathBuf },
    /// Copy an artifact into the current spec and return its path and hash.
    Copy { source: PathBuf, name: String },
    /// Evaluate the current evidence gate.
    Validate,
}

#[derive(Debug, Subcommand)]
enum AgentCommands {
    /// Install or update all supported global agent commands together.
    Sync {
        /// Report changes without writing files.
        #[arg(long)]
        check: bool,
        /// Override the user home (primarily for managed installations and tests).
        #[arg(long)]
        home: Option<PathBuf>,
    },
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match execute(cli) {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => ExitCode::from(2),
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::from(1)
        }
    }
}

fn execute(cli: Cli) -> Result<bool> {
    match cli.command {
        Commands::Init {
            profile,
            mode,
            actor,
        } => {
            let repository = initialize(
                &cli.root,
                &InitOptions {
                    profile,
                    mode,
                    actor,
                },
            )?;
            let state = repository.load_state()?.state;
            emit(&state, cli.json, || {
                format!(
                    "Initialized Empirical SDD at {} (revision {}, {} / {})",
                    repository.root().display(),
                    state.revision,
                    state.profile,
                    state.mode
                )
            })?;
            Ok(true)
        }
        Commands::Adopt { profile, actor } => {
            let repository = SddRepository::discover(&cli.root)?;
            let state = repository.adopt(profile, &actor)?;
            emit(&state, cli.json, || {
                format!(
                    "Adopted {} at revision {}; v1 paths were preserved",
                    repository.root().display(),
                    state.revision
                )
            })?;
            Ok(true)
        }
        Commands::Status => {
            let repository = SddRepository::discover(&cli.root)?;
            let snapshot = repository.snapshot()?;
            let value = json!({
                "root": repository.root(),
                "legacy": snapshot.legacy,
                "config": snapshot.config,
                "state": snapshot.state,
            });
            emit(&value, cli.json, || {
                let state = &value["state"];
                format!(
                    "spec={} phase={} status={} revision={} profile={}{}",
                    state["currentSpec"].as_str().unwrap_or("none"),
                    state["phase"].as_str().unwrap_or("unknown"),
                    state["status"].as_str().unwrap_or("unknown"),
                    state["revision"].as_u64().unwrap_or(0),
                    state["profile"].as_str().unwrap_or("unknown"),
                    if value["legacy"].as_bool() == Some(true) {
                        " (v1: run empirical adopt before mutation)"
                    } else {
                        ""
                    }
                )
            })?;
            Ok(true)
        }
        Commands::New {
            spec_id,
            title,
            profile,
            actor,
        } => {
            let repository = SddRepository::discover(&cli.root)?;
            let state = create_spec(
                &repository,
                &NewSpecOptions {
                    spec_id: spec_id.clone(),
                    title,
                    profile,
                    actor,
                },
            )?;
            emit(&state, cli.json, || {
                format!(
                    "Created and selected {spec_id}; edit its acceptance criteria, then continue at {}",
                    state.phase
                )
            })?;
            Ok(true)
        }
        Commands::Select {
            spec_id,
            profile,
            expected_revision,
            actor,
        } => {
            let repository = SddRepository::discover(&cli.root)?;
            let expected = expected_revision.unwrap_or(repository.reconcile()?.revision);
            let state = repository.select_spec(&spec_id, profile, expected, &actor)?;
            emit(&state, cli.json, || {
                format!(
                    "Selected {spec_id}; next phase is {} at revision {}",
                    state.phase, state.revision
                )
            })?;
            Ok(true)
        }
        Commands::Next { actor } => {
            let repository = SddRepository::discover(&cli.root)?;
            let state = repository.synchronize_spec_revision(&actor)?;
            let config = repository.load_config()?;
            let criteria = if state.current_spec.is_some() {
                repository.current_criteria(&state)?
            } else {
                Vec::new()
            };
            let capabilities = required_capabilities(state.phase, &criteria, &config);
            let value = json!({
                "state": state,
                "workspaceHash": workspace_hash(repository.root())?,
                "requiredCapabilities": capabilities,
                "acceptanceCriteria": criteria,
            });
            emit(&value, cli.json, || {
                format!(
                    "next={} revision={} required={}",
                    value["state"]["phase"].as_str().unwrap_or("idle"),
                    value["state"]["revision"].as_u64().unwrap_or(0),
                    value["requiredCapabilities"]
                        .as_array()
                        .map(|items| items
                            .iter()
                            .map(ToString::to_string)
                            .collect::<Vec<_>>()
                            .join(","))
                        .unwrap_or_default()
                )
            })?;
            Ok(true)
        }
        Commands::Loop { allow_exec, actor } => {
            let repository = SddRepository::discover(&cli.root)?;
            let config = repository.load_config()?;
            let mut adapter = CommandAdapter::new(&config, allow_exec);
            let stop = LoopEngine::new(&repository, &mut adapter, actor).run_until_stop()?;
            let success = matches!(
                stop,
                RunStop::Done { .. } | RunStop::ReadyForDelivery { .. }
            );
            emit(&stop, cli.json, || describe_stop(&stop))?;
            Ok(success)
        }
        Commands::CheckIn {
            result,
            expected_revision,
            actor,
        } => {
            let repository = SddRepository::discover(&cli.root)?;
            let phase_result: PhaseResult = read_json(&result)?;
            let mut adapter = ExternalAdapter;
            let stop = LoopEngine::new(&repository, &mut adapter, actor)
                .check_in(expected_revision, phase_result)?;
            let success = !matches!(stop, RunStop::Blocked { .. });
            emit(&stop, cli.json, || describe_stop(&stop))?;
            Ok(success)
        }
        Commands::Approve {
            expected_revision,
            actor,
        } => {
            let repository = SddRepository::discover(&cli.root)?;
            let mut adapter = ExternalAdapter;
            let state = LoopEngine::new(&repository, &mut adapter, "empirical-approve")
                .approve(expected_revision, &actor)?;
            emit(&state, cli.json, || {
                format!(
                    "Approved continuation to {} at revision {}",
                    state.phase, state.revision
                )
            })?;
            Ok(true)
        }
        Commands::Retry {
            expected_revision,
            actor,
        } => {
            let repository = SddRepository::discover(&cli.root)?;
            let mut adapter = ExternalAdapter;
            let state = LoopEngine::new(&repository, &mut adapter, "empirical-retry")
                .retry(expected_revision, &actor)?;
            emit(&state, cli.json, || {
                format!(
                    "Resumed {} at revision {} after blocker resolution",
                    state.phase, state.revision
                )
            })?;
            Ok(true)
        }
        Commands::Evidence { command } => {
            let repository = SddRepository::discover(&cli.root)?;
            let state = repository.synchronize_spec_revision("empirical-evidence")?;
            let store = EvidenceStore::current(&repository, &state)?;
            match command {
                EvidenceCommands::Add { file } => {
                    let bytes = fs::read(&file).map_err(|error| SddError::io(&file, error))?;
                    let records = if bytes
                        .iter()
                        .copied()
                        .find(|byte| !byte.is_ascii_whitespace())
                        == Some(b'[')
                    {
                        serde_json::from_slice::<Vec<EvidenceRecord>>(&bytes)?
                    } else {
                        vec![serde_json::from_slice::<EvidenceRecord>(&bytes)?]
                    };
                    let index = store.add(records)?;
                    emit(&index, cli.json, || {
                        format!(
                            "Evidence index now contains {} records",
                            index.records.len()
                        )
                    })?;
                    Ok(true)
                }
                EvidenceCommands::Copy { source, name } => {
                    let (path, hash) = copy_evidence_artifact(&repository, &state, &source, &name)?;
                    let value = json!({ "artifactPath": path, "artifactHash": hash });
                    emit(&value, cli.json, || {
                        format!(
                            "Copied evidence artifact to {} ({})",
                            value["artifactPath"], value["artifactHash"]
                        )
                    })?;
                    Ok(true)
                }
                EvidenceCommands::Validate => validate_evidence(&repository, &state, cli.json),
            }
        }
        Commands::Validate => {
            let repository = SddRepository::discover(&cli.root)?;
            let state = repository.synchronize_spec_revision("empirical-validate")?;
            validate_evidence(&repository, &state, cli.json)
        }
        Commands::Recover => {
            let repository = SddRepository::discover(&cli.root)?;
            let state = repository.recover()?;
            emit(&state, cli.json, || {
                format!("Recovered STATE.md through revision {}", state.revision)
            })?;
            Ok(true)
        }
        Commands::Doctor => {
            let repository = SddRepository::discover(&cli.root)?;
            let snapshot = repository.snapshot()?;
            let criteria = snapshot
                .state
                .current_spec
                .as_ref()
                .map(|_| repository.current_criteria(&snapshot.state))
                .transpose()?;
            let adapter = CommandAdapter::new(&snapshot.config, false);
            let kit = upgrade_kit(repository.root(), true)?;
            let healthy = kit.conflicts == 0;
            let value = json!({
                "ok": healthy,
                "root": repository.root(),
                "protocol": "empirical-sdd",
                "schemaVersion": 2,
                "legacy": snapshot.legacy,
                "revision": snapshot.state.revision,
                "eventCount": repository.events()?.len(),
                "criterionCount": criteria.as_ref().map(Vec::len).unwrap_or(0),
                "workspaceHash": workspace_hash(repository.root())?,
                "adapters": adapter.configured_programs(),
                "kit": kit,
                "canonicalStore": "filesystem",
                "externalDatabaseRequired": false,
                "hostRuntimeRequired": false,
                "ideRequired": false,
            });
            emit(&value, cli.json, || {
                format!(
                    "healthy: revision {}, {} events, filesystem canonical; no external database, host runtime, or IDE required",
                    value["revision"], value["eventCount"]
                )
            })?;
            Ok(healthy)
        }
        Commands::Upgrade { check } => {
            let repository = SddRepository::discover(&cli.root)?;
            let report = upgrade_kit(repository.root(), check)?;
            let success = report.conflicts == 0 && (!check || report.up_to_date);
            emit(&report, cli.json, || {
                if report.conflicts > 0 {
                    format!(
                        "Preserved {} locally modified managed file(s); inspect --json output",
                        report.conflicts
                    )
                } else if check && !report.up_to_date {
                    format!(
                        "Empirical repository kit {} is available",
                        report.target_version
                    )
                } else if report.up_to_date {
                    format!(
                        "Empirical repository kit {} is up to date",
                        report.target_version
                    )
                } else {
                    format!(
                        "Updated Empirical repository kit to {}",
                        report.target_version
                    )
                }
            })?;
            Ok(success)
        }
        Commands::Agents { command } => match command {
            AgentCommands::Sync { check, home } => {
                let home = home.map(Ok).unwrap_or_else(default_user_home)?;
                let report = sync_agent_packs(&home, check)?;
                let success = report.conflicts == 0 && (!check || report.up_to_date);
                emit(&report, cli.json, || {
                    if report.conflicts > 0 {
                        format!(
                            "Preserved {} customized agent command(s); inspect --json output",
                            report.conflicts
                        )
                    } else if check && !report.up_to_date {
                        format!(
                            "Empirical agent command packs {} are available",
                            report.target_version
                        )
                    } else if report.up_to_date {
                        format!(
                            "Empirical agent command packs {} are up to date",
                            report.target_version
                        )
                    } else {
                        format!(
                            "Installed Empirical commands for every supported agent ({})",
                            report.target_version
                        )
                    }
                })?;
                Ok(success)
            }
        },
        Commands::Deliver {
            allow_commit,
            allow_push,
            allow_pull_request,
            actor,
        } => {
            let repository = SddRepository::discover(&cli.root)?;
            let mut provider = GitHubDelivery::new(actor);
            let outcome = provider.deliver(
                &repository,
                DeliveryAuthority {
                    commit: allow_commit,
                    push: allow_push,
                    pull_request: allow_pull_request,
                },
            )?;
            emit(&outcome, cli.json, || {
                format!(
                    "Delivery completed{}{}",
                    outcome
                        .commit_sha
                        .as_deref()
                        .map(|sha| format!(" at {}", &sha[..sha.len().min(12)]))
                        .unwrap_or_default(),
                    outcome
                        .pull_request_url
                        .as_deref()
                        .map(|url| format!("; {url}"))
                        .unwrap_or_default()
                )
            })?;
            Ok(true)
        }
    }
}

fn validate_evidence(
    repository: &SddRepository,
    state: &empirical_sdd::State,
    json: bool,
) -> Result<bool> {
    let config = repository.load_config()?;
    let criteria = repository.current_criteria(state)?;
    let report =
        EvidenceStore::current(repository, state)?.evaluate(&criteria, &config.evidence)?;
    emit(&report, json, || {
        if report.valid {
            format!(
                "Evidence gate passed with {} current records",
                report.current_records
            )
        } else {
            format!("Evidence gate failed: {}", report.missing.join("; "))
        }
    })?;
    Ok(report.valid)
}

fn read_json<T: serde::de::DeserializeOwned>(path: &PathBuf) -> Result<T> {
    let bytes = if path.as_os_str() == "-" {
        let mut bytes = Vec::new();
        io::stdin()
            .read_to_end(&mut bytes)
            .map_err(|error| SddError::io("<stdin>", error))?;
        bytes
    } else {
        fs::read(path).map_err(|error| SddError::io(path, error))?
    };
    Ok(serde_json::from_slice(&bytes)?)
}

fn emit<T, F>(value: &T, json_output: bool, human: F) -> Result<()>
where
    T: Serialize,
    F: FnOnce() -> String,
{
    if json_output {
        println!("{}", serde_json::to_string_pretty(value)?);
    } else {
        println!("{}", human());
    }
    Ok(())
}

fn describe_stop(stop: &RunStop) -> String {
    match stop {
        RunStop::Done { state } => format!("Done at revision {}", state.revision),
        RunStop::Blocked { state, message } => {
            format!("Blocked at revision {}: {message}", state.revision)
        }
        RunStop::AwaitingHuman { state, message } => {
            format!("Awaiting human at revision {}: {message}", state.revision)
        }
        RunStop::MissingAdapter { state, phase } => {
            format!("Missing {phase} adapter at revision {}", state.revision)
        }
        RunStop::MissingCapabilities {
            state,
            phase,
            capabilities,
        } => format!(
            "Missing capabilities for {phase} at revision {}: {}",
            state.revision,
            capabilities
                .iter()
                .map(|capability| format!("{capability:?}").to_ascii_lowercase())
                .collect::<Vec<_>>()
                .join(", ")
        ),
        RunStop::ReadyForDelivery { state } => {
            format!(
                "QA and review passed; delivery is ready at revision {}",
                state.revision
            )
        }
        RunStop::Paused { state } => {
            format!("Paused at {} / revision {}", state.phase, state.revision)
        }
    }
}

struct ExternalAdapter;

impl PhaseAdapter for ExternalAdapter {
    fn supports(&self, _phase: Phase) -> bool {
        false
    }

    fn capabilities(&self, _phase: Phase) -> Result<BTreeSet<Capability>> {
        Ok(BTreeSet::new())
    }

    fn execute(&mut self, _context: &PhaseContext) -> Result<PhaseResult> {
        Err(SddError::Adapter(
            "external adapter cannot execute phases".into(),
        ))
    }
}
