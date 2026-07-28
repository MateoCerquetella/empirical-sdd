use std::collections::BTreeSet;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::str::FromStr;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use ulid::Ulid;
use wait_timeout::ChildExt;

use crate::config::{CommandAdapterConfig, Config};
use crate::error::{Result, SddError};
use crate::model::{Criterion, Phase, PhaseResult, Profile, SCHEMA_VERSION, valid_identity};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Capability {
    Tests,
    Browser,
    Screenshots,
    ScreenshotReview,
    CodeReview,
}

impl FromStr for Capability {
    type Err = SddError;

    fn from_str(value: &str) -> Result<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "test" | "tests" => Ok(Self::Tests),
            "browser" | "browser_mcp" => Ok(Self::Browser),
            "screenshot" | "screenshots" => Ok(Self::Screenshots),
            "screenshot_review" | "visual_review" => Ok(Self::ScreenshotReview),
            "code_review" | "review" => Ok(Self::CodeReview),
            other => Err(SddError::InvalidConfig(format!(
                "unknown adapter capability '{other}'"
            ))),
        }
    }
}

#[derive(Debug, Clone)]
pub struct PhaseContext {
    pub root: PathBuf,
    pub spec_id: String,
    pub spec_dir: PathBuf,
    pub phase: Phase,
    pub profile: Profile,
    pub revision: u64,
    pub spec_revision: u64,
    pub workspace_hash: String,
    pub criteria: Vec<Criterion>,
    pub required_capabilities: BTreeSet<Capability>,
}

pub trait PhaseAdapter {
    fn supports(&self, phase: Phase) -> bool;
    fn capabilities(&self, phase: Phase) -> Result<BTreeSet<Capability>>;
    fn execute(&mut self, context: &PhaseContext) -> Result<PhaseResult>;
}

pub struct CommandAdapter {
    adapters: std::collections::BTreeMap<String, CommandAdapterConfig>,
    allow_execution: bool,
}

impl CommandAdapter {
    pub fn new(config: &Config, allow_execution: bool) -> Self {
        Self {
            adapters: config.adapters.clone(),
            allow_execution,
        }
    }

    pub fn configured_programs(&self) -> Vec<ProgramStatus> {
        self.adapters
            .iter()
            .map(|(phase, adapter)| ProgramStatus {
                phase: phase.clone(),
                program: adapter.program.clone(),
                available: program_available(&adapter.program),
            })
            .collect()
    }

    fn adapter_for(&self, phase: Phase) -> Option<&CommandAdapterConfig> {
        self.adapters.get(&phase.to_string())
    }
}

impl PhaseAdapter for CommandAdapter {
    fn supports(&self, phase: Phase) -> bool {
        self.adapter_for(phase).is_some()
    }

    fn capabilities(&self, phase: Phase) -> Result<BTreeSet<Capability>> {
        let adapter = self
            .adapter_for(phase)
            .ok_or_else(|| SddError::MissingAdapter(phase.to_string()))?;
        adapter
            .capabilities
            .iter()
            .map(|capability| capability.parse())
            .collect()
    }

    fn execute(&mut self, context: &PhaseContext) -> Result<PhaseResult> {
        if !self.allow_execution {
            return Err(SddError::ExecutionNotAuthorized);
        }
        let adapter = self
            .adapter_for(context.phase)
            .ok_or_else(|| SddError::MissingAdapter(context.phase.to_string()))?
            .clone();
        let program = resolve_program(&adapter.program, &context.root).ok_or_else(|| {
            SddError::MissingCapability(format!(
                "adapter program '{}' is not available",
                adapter.program
            ))
        })?;

        let temporary = std::env::temp_dir().join(format!("empirical-sdd-{}", Ulid::new()));
        fs::create_dir_all(&temporary).map_err(|error| SddError::io(&temporary, error))?;
        let result_path = temporary.join("phase-result.json");
        let context_path = temporary.join("phase-context.json");
        let stdout_path = temporary.join("stdout.log");
        let stderr_path = temporary.join("stderr.log");
        let context_document = SerializablePhaseContext::from(context);
        fs::write(&context_path, serde_json::to_vec_pretty(&context_document)?)
            .map_err(|error| SddError::io(&context_path, error))?;

        let replacements = Replacements {
            root: context.root.to_string_lossy().into_owned(),
            spec: context.spec_id.clone(),
            spec_dir: context.spec_dir.to_string_lossy().into_owned(),
            phase: context.phase.to_string(),
            profile: context.profile.to_string(),
            workspace_hash: context.workspace_hash.clone(),
            result: result_path.to_string_lossy().into_owned(),
            context: context_path.to_string_lossy().into_owned(),
        };
        let stdout =
            File::create(&stdout_path).map_err(|error| SddError::io(&stdout_path, error))?;
        let stderr =
            File::create(&stderr_path).map_err(|error| SddError::io(&stderr_path, error))?;
        let mut command = Command::new(&program);
        command
            .args(
                adapter
                    .args
                    .iter()
                    .map(|argument| substitute(argument, &replacements)),
            )
            .current_dir(&context.root)
            .stdout(Stdio::from(stdout))
            .stderr(Stdio::from(stderr))
            .env("EMPIRICAL_PROTOCOL", "empirical-sdd")
            .env("EMPIRICAL_SCHEMA_VERSION", SCHEMA_VERSION.to_string())
            .env("EMPIRICAL_REPO_ROOT", &replacements.root)
            .env("EMPIRICAL_SPEC_ID", &replacements.spec)
            .env("EMPIRICAL_SPEC_DIR", &replacements.spec_dir)
            .env("EMPIRICAL_PHASE", &replacements.phase)
            .env("EMPIRICAL_PROFILE", &replacements.profile)
            .env("EMPIRICAL_WORKSPACE_HASH", &replacements.workspace_hash)
            .env("EMPIRICAL_CONTEXT_PATH", &replacements.context)
            .env("EMPIRICAL_RESULT_PATH", &replacements.result)
            // SDD_* remains a compatibility alias for v1 adapters.
            .env("SDD_PROTOCOL", "empirical-sdd")
            .env("SDD_SCHEMA_VERSION", SCHEMA_VERSION.to_string())
            .env("SDD_REPO_ROOT", &replacements.root)
            .env("SDD_SPEC_ID", &replacements.spec)
            .env("SDD_SPEC_DIR", &replacements.spec_dir)
            .env("SDD_PHASE", &replacements.phase)
            .env("SDD_PROFILE", &replacements.profile)
            .env("SDD_WORKSPACE_HASH", &replacements.workspace_hash)
            .env("SDD_CONTEXT_PATH", &replacements.context)
            .env("SDD_RESULT_PATH", &replacements.result);
        for (key, value) in &adapter.environment {
            command.env(key, substitute(value, &replacements));
        }
        let mut child = command.spawn().map_err(|error| {
            SddError::Adapter(format!("could not start '{}': {error}", adapter.program))
        })?;
        let status = match child
            .wait_timeout(Duration::from_secs(adapter.timeout_seconds))
            .map_err(|error| SddError::Adapter(format!("could not wait for adapter: {error}")))?
        {
            Some(status) => status,
            None => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(SddError::Adapter(format!(
                    "{} adapter timed out after {} seconds",
                    context.phase, adapter.timeout_seconds
                )));
            }
        };

        let stderr = bounded_read(&stderr_path, 8 * 1024);
        if !status.success() {
            return Err(SddError::Adapter(format!(
                "{} adapter exited with {}{}",
                context.phase,
                status,
                if stderr.is_empty() {
                    String::new()
                } else {
                    format!(": {stderr}")
                }
            )));
        }
        if !result_path.is_file() {
            return Err(SddError::Adapter(format!(
                "{} adapter passed without writing the required result envelope {}",
                context.phase,
                result_path.display()
            )));
        }
        let bytes = fs::read(&result_path).map_err(|error| SddError::io(&result_path, error))?;
        let result: PhaseResult = serde_json::from_slice(&bytes)?;
        if result.schema_version != SCHEMA_VERSION {
            return Err(SddError::Adapter(format!(
                "adapter returned unsupported schema {}",
                result.schema_version
            )));
        }
        if !valid_identity(&result.actor) || result.summary.trim().is_empty() {
            return Err(SddError::Adapter(
                "adapter result needs a valid actor identity and non-blank summary".into(),
            ));
        }
        let _ = fs::remove_dir_all(&temporary);
        Ok(result)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct SerializablePhaseContext<'a> {
    schema_version: u32,
    root: &'a Path,
    spec_id: &'a str,
    spec_dir: &'a Path,
    phase: Phase,
    profile: Profile,
    revision: u64,
    spec_revision: u64,
    workspace_hash: &'a str,
    criteria: &'a [Criterion],
    required_capabilities: &'a BTreeSet<Capability>,
}

impl<'a> From<&'a PhaseContext> for SerializablePhaseContext<'a> {
    fn from(context: &'a PhaseContext) -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            root: &context.root,
            spec_id: &context.spec_id,
            spec_dir: &context.spec_dir,
            phase: context.phase,
            profile: context.profile,
            revision: context.revision,
            spec_revision: context.spec_revision,
            workspace_hash: &context.workspace_hash,
            criteria: &context.criteria,
            required_capabilities: &context.required_capabilities,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramStatus {
    pub phase: String,
    pub program: String,
    pub available: bool,
}

struct Replacements {
    root: String,
    spec: String,
    spec_dir: String,
    phase: String,
    profile: String,
    workspace_hash: String,
    result: String,
    context: String,
}

fn substitute(value: &str, replacements: &Replacements) -> String {
    value
        .replace("{root}", &replacements.root)
        .replace("{spec}", &replacements.spec)
        .replace("{spec_dir}", &replacements.spec_dir)
        .replace("{phase}", &replacements.phase)
        .replace("{profile}", &replacements.profile)
        .replace("{workspace_hash}", &replacements.workspace_hash)
        .replace("{result}", &replacements.result)
        .replace("{context}", &replacements.context)
}

fn program_available(program: &str) -> bool {
    let current = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    resolve_program(program, &current).is_some()
}

fn resolve_program(program: &str, root: &Path) -> Option<PathBuf> {
    let path = Path::new(program);
    if path.components().count() > 1 {
        let candidate = if path.is_absolute() {
            path.to_path_buf()
        } else {
            root.join(path)
        };
        return candidate.is_file().then_some(candidate);
    }
    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .any(|directory| {
                let candidate = directory.join(program);
                if candidate.is_file() {
                    return true;
                }
                #[cfg(windows)]
                {
                    ["exe", "cmd", "bat"]
                        .iter()
                        .any(|extension| candidate.with_extension(extension).is_file())
                }
                #[cfg(not(windows))]
                {
                    false
                }
            })
            .then(|| PathBuf::from(program))
    })
}

fn bounded_read(path: &Path, limit: usize) -> String {
    let Ok(bytes) = fs::read(path) else {
        return String::new();
    };
    let start = bytes.len().saturating_sub(limit);
    String::from_utf8_lossy(&bytes[start..]).trim().to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::CommandAdapterConfig;
    use crate::workspace::workspace_hash;

    #[test]
    fn command_placeholders_are_data_not_shell_text() {
        let replacements = Replacements {
            root: "/tmp/a repo".into(),
            spec: "001-test".into(),
            spec_dir: "/tmp/a repo/ai/specs/001-test".into(),
            phase: "verify".into(),
            profile: "quick".into(),
            workspace_hash: format!("sha256:{}", "0".repeat(64)),
            result: "/tmp/result.json".into(),
            context: "/tmp/context.json".into(),
        };
        assert_eq!(
            substitute("--root={root}", &replacements),
            "--root=/tmp/a repo"
        );
    }

    #[test]
    fn execution_requires_caller_authority() {
        let mut config = Config::default();
        config.adapters.insert(
            "verify".into(),
            CommandAdapterConfig {
                program: "definitely-not-run".into(),
                ..Default::default()
            },
        );
        let mut adapter = CommandAdapter::new(&config, false);
        let result = adapter.execute(&PhaseContext {
            root: PathBuf::from("."),
            spec_id: "001".into(),
            spec_dir: PathBuf::from("ai/specs/001"),
            phase: Phase::Verify,
            profile: Profile::Quick,
            revision: 1,
            spec_revision: 1,
            workspace_hash: workspace_hash(Path::new(".")).unwrap(),
            criteria: Vec::new(),
            required_capabilities: BTreeSet::new(),
        });
        assert!(matches!(result, Err(SddError::ExecutionNotAuthorized)));
    }

    #[cfg(unix)]
    #[test]
    fn zero_exit_without_result_envelope_does_not_pass() {
        let directory = tempfile::tempdir().unwrap();
        let mut config = Config::default();
        config.adapters.insert(
            "verify".into(),
            CommandAdapterConfig {
                program: "sh".into(),
                args: vec!["-c".into(), ":".into()],
                timeout_seconds: 5,
                ..Default::default()
            },
        );
        let mut adapter = CommandAdapter::new(&config, true);
        let result = adapter.execute(&PhaseContext {
            root: directory.path().to_path_buf(),
            spec_id: "001".into(),
            spec_dir: directory.path().join("ai/specs/001"),
            phase: Phase::Verify,
            profile: Profile::Quick,
            revision: 1,
            spec_revision: 1,
            workspace_hash: workspace_hash(directory.path()).unwrap(),
            criteria: Vec::new(),
            required_capabilities: BTreeSet::new(),
        });

        assert!(matches!(
            result,
            Err(SddError::Adapter(message)) if message.contains("required result envelope")
        ));
    }
}
