use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::{Result, SddError};
use crate::model::{Phase, Profile, SCHEMA_VERSION};
use crate::spec::validate_relative_path;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Config {
    pub schema_version: u32,
    pub profile: Profile,
    pub loop_policy: LoopPolicy,
    pub evidence: EvidencePolicy,
    pub delivery: DeliveryConfig,
    pub adapters: BTreeMap<String, CommandAdapterConfig>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            profile: Profile::Quick,
            loop_policy: LoopPolicy::default(),
            evidence: EvidencePolicy::default(),
            delivery: DeliveryConfig::default(),
            adapters: BTreeMap::new(),
        }
    }
}

impl Config {
    pub fn legacy_default() -> Self {
        Self {
            profile: Profile::Strong,
            ..Self::default()
        }
    }

    pub fn from_path(path: &Path) -> Result<Self> {
        let text = fs::read_to_string(path).map_err(|error| SddError::io(path, error))?;
        let config: Self = toml::from_str(&text)?;
        config.validate()?;
        Ok(config)
    }

    pub fn to_toml(&self) -> Result<String> {
        self.validate()?;
        Ok(toml::to_string_pretty(self)?)
    }

    pub fn validate(&self) -> Result<()> {
        if self.schema_version != SCHEMA_VERSION {
            return Err(SddError::InvalidConfig(format!(
                "unsupported schema_version {}; expected {}",
                self.schema_version, SCHEMA_VERSION
            )));
        }
        if self.loop_policy.max_repair_attempts > 20 {
            return Err(SddError::InvalidConfig(
                "max_repair_attempts must be between 0 and 20".into(),
            ));
        }
        if self.delivery.pull_request && !self.delivery.push {
            return Err(SddError::InvalidConfig(
                "delivery.pull_request requires delivery.push".into(),
            ));
        }
        if self.delivery.commit && self.delivery.paths.is_empty() {
            return Err(SddError::InvalidConfig(
                "delivery.paths must name explicit paths when commit is enabled".into(),
            ));
        }
        if self.delivery.commit && self.delivery.commit_message.trim().is_empty() {
            return Err(SddError::InvalidConfig(
                "delivery.commit_message must not be blank when commit is enabled".into(),
            ));
        }
        if self.delivery.push && self.delivery.remote.trim().is_empty() {
            return Err(SddError::InvalidConfig(
                "delivery.remote must not be blank when push is enabled".into(),
            ));
        }
        if self.delivery.remote.starts_with('-')
            || self.delivery.remote.chars().any(char::is_control)
        {
            return Err(SddError::InvalidConfig(
                "delivery.remote must be a Git remote name, not an option or control string".into(),
            ));
        }
        if self.delivery.base_branch.as_deref().is_some_and(|branch| {
            branch.trim().is_empty()
                || branch.starts_with('-')
                || branch.chars().any(char::is_control)
        }) {
            return Err(SddError::InvalidConfig(
                "delivery.base_branch must not be blank, option-like, or contain control characters"
                    .into(),
            ));
        }
        let mut delivery_paths = BTreeSet::new();
        for path in &self.delivery.paths {
            validate_relative_path(path).map_err(|error| {
                SddError::InvalidConfig(format!("invalid delivery path '{path}': {error}"))
            })?;
            if !delivery_paths.insert(path) {
                return Err(SddError::InvalidConfig(format!(
                    "delivery.paths contains duplicate path '{path}'"
                )));
            }
        }
        for (phase, adapter) in &self.adapters {
            let parsed_phase = phase.parse::<Phase>().map_err(|_| {
                SddError::InvalidConfig(format!("adapter key '{phase}' is not a known phase"))
            })?;
            if parsed_phase.to_string() != *phase
                || matches!(parsed_phase, Phase::Idle | Phase::Deliver | Phase::Done)
            {
                return Err(SddError::InvalidConfig(format!(
                    "adapter key '{phase}' must be a canonical executable phase name"
                )));
            }
            if adapter.program.trim().is_empty() {
                return Err(SddError::InvalidConfig(format!(
                    "adapter '{phase}' has a blank program"
                )));
            }
            if adapter.timeout_seconds == 0 {
                return Err(SddError::InvalidConfig(format!(
                    "adapter '{phase}' timeout_seconds must be positive"
                )));
            }
            if let Some(key) = adapter.environment.keys().find(|key| {
                key.to_ascii_uppercase().starts_with("SDD_")
                    || key.to_ascii_uppercase().starts_with("EMPIRICAL_")
            }) {
                return Err(SddError::InvalidConfig(format!(
                    "adapter '{phase}' cannot override reserved environment variable '{key}'"
                )));
            }
            let mut capabilities = BTreeSet::new();
            for capability in &adapter.capabilities {
                let normalized = capability.trim().to_ascii_lowercase();
                if !matches!(
                    normalized.as_str(),
                    "test"
                        | "tests"
                        | "browser"
                        | "browser_mcp"
                        | "screenshot"
                        | "screenshots"
                        | "screenshot_review"
                        | "visual_review"
                        | "code_review"
                        | "review"
                ) {
                    return Err(SddError::InvalidConfig(format!(
                        "adapter '{phase}' has unknown capability '{capability}'"
                    )));
                }
                if !capabilities.insert(normalized) {
                    return Err(SddError::InvalidConfig(format!(
                        "adapter '{phase}' repeats capability '{capability}'"
                    )));
                }
            }
        }
        Ok(())
    }

    pub fn delivery_enabled(&self) -> bool {
        self.delivery.commit || self.delivery.push || self.delivery.pull_request
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct LoopPolicy {
    pub auto_continue: bool,
    pub max_repair_attempts: u8,
}

impl Default for LoopPolicy {
    fn default() -> Self {
        Self {
            auto_continue: true,
            max_repair_attempts: 2,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BrowserRequirement {
    Disabled,
    WhenAvailable,
    RequiredForUi,
    Required,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct EvidencePolicy {
    pub require_per_criterion: bool,
    pub tests: bool,
    pub code_review: bool,
    pub independent_code_review: bool,
    pub browser: BrowserRequirement,
    pub screenshots_for_ui: bool,
    pub screenshot_review_for_ui: bool,
}

impl Default for EvidencePolicy {
    fn default() -> Self {
        Self {
            require_per_criterion: true,
            tests: true,
            code_review: true,
            independent_code_review: true,
            browser: BrowserRequirement::RequiredForUi,
            screenshots_for_ui: true,
            screenshot_review_for_ui: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct DeliveryConfig {
    pub commit: bool,
    pub push: bool,
    pub pull_request: bool,
    pub paths: Vec<String>,
    pub commit_message: String,
    pub remote: String,
    pub base_branch: Option<String>,
    pub draft_pull_request: bool,
}

impl Default for DeliveryConfig {
    fn default() -> Self {
        Self {
            commit: false,
            push: false,
            pull_request: false,
            paths: Vec::new(),
            commit_message: "feat: complete {spec}".into(),
            remote: "origin".into(),
            base_branch: None,
            draft_pull_request: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct CommandAdapterConfig {
    pub program: String,
    pub args: Vec<String>,
    pub environment: BTreeMap<String, String>,
    pub timeout_seconds: u64,
    pub capabilities: Vec<String>,
}

impl Default for CommandAdapterConfig {
    fn default() -> Self {
        Self {
            program: String::new(),
            args: Vec::new(),
            environment: BTreeMap::new(),
            timeout_seconds: 1_800,
            capabilities: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_fast_but_evidence_strong_and_delivery_off() {
        let config = Config::default();
        assert_eq!(config.profile, Profile::Quick);
        assert!(config.loop_policy.auto_continue);
        assert_eq!(config.loop_policy.max_repair_attempts, 2);
        assert!(config.evidence.require_per_criterion);
        assert!(config.evidence.tests);
        assert!(config.evidence.code_review);
        assert!(!config.delivery_enabled());
    }

    #[test]
    fn legacy_defaults_to_the_full_profile() {
        assert_eq!(Config::legacy_default().profile, Profile::Strong);
    }

    #[test]
    fn pull_request_cannot_silently_skip_push() {
        let mut config = Config::default();
        config.delivery.pull_request = true;
        assert!(config.validate().is_err());
    }

    #[test]
    fn config_round_trips_through_toml() {
        let config = Config::default();
        let encoded = config.to_toml().unwrap();
        let decoded: Config = toml::from_str(&encoded).unwrap();
        assert_eq!(decoded, config);
    }

    #[test]
    fn adapters_cannot_override_protocol_environment() {
        for reserved in ["SDD_PHASE", "empirical_result_path"] {
            let mut config = Config::default();
            config.adapters.insert(
                "verify".into(),
                CommandAdapterConfig {
                    program: "adapter".into(),
                    environment: BTreeMap::from([(reserved.into(), "spoofed".into())]),
                    ..Default::default()
                },
            );

            assert!(
                config.validate().is_err(),
                "accepted reserved key {reserved}"
            );
        }
    }

    #[test]
    fn adapter_phase_names_and_delivery_remote_are_not_option_injection() {
        let mut config = Config::default();
        config.adapters.insert(
            "Verify".into(),
            CommandAdapterConfig {
                program: "adapter".into(),
                ..Default::default()
            },
        );
        assert!(config.validate().is_err());

        let mut config = Config::default();
        config.delivery.push = true;
        config.delivery.remote = "--force".into();
        assert!(config.validate().is_err());
    }

    #[test]
    fn configuration_typos_fail_closed() {
        let typo = Config::default()
            .to_toml()
            .unwrap()
            .replace("pull_request = false", "pul_request = true");
        assert!(toml::from_str::<Config>(&typo).is_err());
    }
}
