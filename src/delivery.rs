//! Guarded Git and GitHub delivery.
//!
//! Repository configuration expresses intent, while `DeliveryAuthority`
//! expresses permission from the current caller. Both must allow an action.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use serde::{Deserialize, Serialize};

use crate::config::{Config, DeliveryConfig};
use crate::error::{Result, SddError};
use crate::evidence::EvidenceStore;
use crate::model::{EventKind, Phase, State, WorkflowStatus};
use crate::repository::SddRepository;
use crate::spec::validate_relative_path;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryAuthority {
    pub commit: bool,
    pub push: bool,
    pub pull_request: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryOutcome {
    pub state: State,
    pub commit_sha: Option<String>,
    pub branch: Option<String>,
    pub pushed: bool,
    pub pull_request_url: Option<String>,
}

pub trait DeliveryProvider {
    fn deliver(
        &mut self,
        repository: &SddRepository,
        authority: DeliveryAuthority,
    ) -> Result<DeliveryOutcome>;
}

#[derive(Debug, Clone)]
pub struct GitHubDelivery {
    actor: String,
}

impl GitHubDelivery {
    pub fn new(actor: impl Into<String>) -> Self {
        Self {
            actor: actor.into(),
        }
    }
}

impl Default for GitHubDelivery {
    fn default() -> Self {
        Self::new("empirical-delivery")
    }
}

impl DeliveryProvider for GitHubDelivery {
    fn deliver(
        &mut self,
        repository: &SddRepository,
        authority: DeliveryAuthority,
    ) -> Result<DeliveryOutcome> {
        let state = repository.synchronize_spec_revision(&self.actor)?;
        let config = repository.load_config()?;
        validate_delivery_gate(repository, &state, &config, authority)?;
        assert_git_root(repository.root())?;

        let delivery = &config.delivery;
        let spec_id = state.current_spec.as_deref().ok_or_else(|| {
            SddError::InvalidState("delivery phase has no current specification".into())
        })?;
        let message = delivery.commit_message.replace("{spec}", spec_id);
        let mut commit_sha = None;
        let mut branch = None;
        let mut pushed = false;
        let mut pull_request_url = None;

        if delivery.commit {
            let scopes = validate_delivery_paths(&delivery.paths)?;
            reject_out_of_scope_staged_files(repository.root(), &scopes)?;
            let mut args = vec![OsString::from("add"), OsString::from("--")];
            args.extend(delivery.paths.iter().map(OsString::from));
            run_checked(repository.root(), "git", &args)?;
            reject_out_of_scope_staged_files(repository.root(), &scopes)?;
            if has_staged_changes(repository.root())? {
                run_checked(
                    repository.root(),
                    "git",
                    &[
                        OsString::from("commit"),
                        OsString::from("-m"),
                        message.clone().into(),
                    ],
                )?;
                commit_sha = Some(command_text(
                    repository.root(),
                    "git",
                    &[OsString::from("rev-parse"), OsString::from("HEAD")],
                )?);
            }
        }

        if delivery.push || delivery.pull_request {
            let current_branch = command_text(
                repository.root(),
                "git",
                &[
                    OsString::from("symbolic-ref"),
                    OsString::from("--short"),
                    OsString::from("HEAD"),
                ],
            )?;
            if current_branch.is_empty() {
                return Err(SddError::Delivery(
                    "cannot deliver from a detached HEAD".into(),
                ));
            }
            branch = Some(current_branch.clone());
            if delivery.push {
                run_checked(
                    repository.root(),
                    "git",
                    &[
                        OsString::from("push"),
                        OsString::from(&delivery.remote),
                        OsString::from(&current_branch),
                    ],
                )?;
                pushed = true;
            }
            if delivery.pull_request {
                let base = match delivery.base_branch.as_deref() {
                    Some(base) if !base.trim().is_empty() => base.to_owned(),
                    _ => command_text(
                        repository.root(),
                        "gh",
                        &[
                            OsString::from("repo"),
                            OsString::from("view"),
                            OsString::from("--json"),
                            OsString::from("defaultBranchRef"),
                            OsString::from("--jq"),
                            OsString::from(".defaultBranchRef.name"),
                        ],
                    )?,
                };
                if current_branch == base {
                    return Err(SddError::Delivery(format!(
                        "pull requests require a feature branch; current branch is the base '{base}'"
                    )));
                }
                pull_request_url = existing_pull_request(repository.root(), &current_branch)?;
                if pull_request_url.is_none() {
                    let body = format!(
                        "Completes Empirical SDD spec `{spec_id}` after verification and review passed."
                    );
                    let mut args = vec![
                        OsString::from("pr"),
                        OsString::from("create"),
                        OsString::from("--head"),
                        OsString::from(&current_branch),
                        OsString::from("--base"),
                        OsString::from(base),
                        OsString::from("--title"),
                        OsString::from(message),
                        OsString::from("--body"),
                        OsString::from(body),
                    ];
                    if delivery.draft_pull_request {
                        args.push(OsString::from("--draft"));
                    }
                    pull_request_url = Some(command_text(repository.root(), "gh", &args)?);
                }
            }
        }

        let completed = repository.transition(
            state.revision,
            EventKind::DeliveryCompleted,
            &self.actor,
            "Configured delivery actions completed",
            |state, _| {
                state.phase = Phase::Done;
                state.status = WorkflowStatus::Done;
                state.message = None;
                Ok(())
            },
        )?;
        Ok(DeliveryOutcome {
            state: completed,
            commit_sha,
            branch,
            pushed,
            pull_request_url,
        })
    }
}

fn validate_delivery_gate(
    repository: &SddRepository,
    state: &State,
    config: &Config,
    authority: DeliveryAuthority,
) -> Result<()> {
    if state.phase != Phase::Deliver || state.status != WorkflowStatus::Waiting {
        return Err(SddError::DeliveryBeforeReview);
    }
    if !config.delivery_enabled() {
        return Err(SddError::Delivery(
            "all delivery actions are disabled in ai/empirical.toml".into(),
        ));
    }
    require_authority(&config.delivery, authority)?;
    let criteria = repository.current_criteria(state)?;
    let report =
        EvidenceStore::current(repository, state)?.evaluate(&criteria, &config.evidence)?;
    if !report.valid {
        return Err(SddError::EvidenceGate(report.missing.join("; ")));
    }
    Ok(())
}

fn require_authority(config: &DeliveryConfig, authority: DeliveryAuthority) -> Result<()> {
    for (enabled, allowed, name) in [
        (config.commit, authority.commit, "commit"),
        (config.push, authority.push, "push"),
        (config.pull_request, authority.pull_request, "pull_request"),
    ] {
        if enabled && !allowed {
            return Err(SddError::DeliveryNotAuthorized(name.into()));
        }
    }
    Ok(())
}

fn validate_delivery_paths(paths: &[String]) -> Result<Vec<PathBuf>> {
    paths
        .iter()
        .map(|path| {
            validate_relative_path(path)?;
            Ok(PathBuf::from(path))
        })
        .collect()
}

fn assert_git_root(root: &Path) -> Result<()> {
    let actual = command_text(
        root,
        "git",
        &[
            OsString::from("rev-parse"),
            OsString::from("--show-toplevel"),
        ],
    )?;
    let actual = PathBuf::from(actual)
        .canonicalize()
        .map_err(|error| SddError::io(root, error))?;
    if actual != root {
        return Err(SddError::Delivery(format!(
            "Empirical root {} is not Git root {}",
            root.display(),
            actual.display()
        )));
    }
    Ok(())
}

fn reject_out_of_scope_staged_files(root: &Path, scopes: &[PathBuf]) -> Result<()> {
    let output = run_checked(
        root,
        "git",
        &[
            OsString::from("diff"),
            OsString::from("--cached"),
            OsString::from("--name-only"),
            OsString::from("-z"),
        ],
    )?;
    for raw in output
        .stdout
        .split(|byte| *byte == 0)
        .filter(|path| !path.is_empty())
    {
        let relative = PathBuf::from(String::from_utf8_lossy(raw).into_owned());
        if !scopes
            .iter()
            .any(|scope| relative == *scope || relative.starts_with(scope))
        {
            return Err(SddError::Delivery(format!(
                "refusing to commit pre-staged path outside delivery.paths: {}",
                relative.display()
            )));
        }
    }
    Ok(())
}

fn has_staged_changes(root: &Path) -> Result<bool> {
    let status = Command::new("git")
        .args(["diff", "--cached", "--quiet", "--exit-code"])
        .current_dir(root)
        .status()
        .map_err(|error| SddError::Delivery(format!("could not run git: {error}")))?;
    match status.code() {
        Some(0) => Ok(false),
        Some(1) => Ok(true),
        _ => Err(SddError::Delivery(format!(
            "git diff --cached failed with {status}"
        ))),
    }
}

fn existing_pull_request(root: &Path, branch: &str) -> Result<Option<String>> {
    let output = Command::new("gh")
        .args([
            "pr", "list", "--head", branch, "--state", "open", "--limit", "1", "--json", "url",
            "--jq", ".[0].url",
        ])
        .current_dir(root)
        .output()
        .map_err(|error| SddError::Delivery(format!("could not run gh: {error}")))?;
    if output.status.success() {
        let url = bounded_text(&output.stdout);
        return Ok((!url.is_empty()).then_some(url));
    }
    Ok(None)
}

fn command_text(root: &Path, program: &str, args: &[OsString]) -> Result<String> {
    let output = run_checked(root, program, args)?;
    Ok(bounded_text(&output.stdout))
}

fn run_checked(root: &Path, program: &str, args: &[OsString]) -> Result<Output> {
    let output = Command::new(program)
        .args(args)
        .current_dir(root)
        .output()
        .map_err(|error| SddError::Delivery(format!("could not run {program}: {error}")))?;
    if !output.status.success() {
        return Err(SddError::Delivery(format!(
            "{program} failed with {}: {}",
            output.status,
            bounded_text(&output.stderr)
        )));
    }
    Ok(output)
}

fn bounded_text(bytes: &[u8]) -> String {
    const LIMIT: usize = 32 * 1024;
    let start = bytes.len().saturating_sub(LIMIT);
    String::from_utf8_lossy(&bytes[start..]).trim().to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn configuration_cannot_grant_its_own_delivery_authority() {
        let config = DeliveryConfig {
            commit: true,
            paths: vec!["src".into()],
            ..Default::default()
        };
        let error = require_authority(&config, DeliveryAuthority::default()).unwrap_err();
        assert!(matches!(error, SddError::DeliveryNotAuthorized(action) if action == "commit"));
    }

    #[test]
    fn delivery_paths_reject_root_and_traversal() {
        assert!(validate_delivery_paths(&["src".into(), "ai/STATE.md".into()]).is_ok());
        assert!(validate_delivery_paths(&[".".into()]).is_err());
        assert!(validate_delivery_paths(&["../secret".into()]).is_err());
    }
}
