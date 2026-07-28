//! Empirical SDD is a portable, filesystem-first Spec-Driven Development
//! protocol. The repository is the source of truth; IDE and agent databases are
//! optional projections.

pub mod adapter;
pub mod agents;
pub mod config;
pub mod delivery;
pub mod engine;
pub mod error;
pub mod evidence;
pub mod feature;
pub mod init;
pub mod kit;
pub mod legacy;
pub mod model;
pub mod repository;
pub mod spec;
pub mod workspace;

pub use adapter::{Capability, CommandAdapter, PhaseAdapter, PhaseContext, ProgramStatus};
pub use agents::{AgentPackEntry, AgentPackReport, default_user_home, sync_agent_packs};
pub use config::{
    BrowserRequirement, CommandAdapterConfig, Config, DeliveryConfig, EvidencePolicy, LoopPolicy,
};
pub use delivery::{DeliveryAuthority, DeliveryOutcome, DeliveryProvider, GitHubDelivery};
pub use engine::{LoopEngine, RunStop, required_capabilities};
pub use error::{Result, SddError};
pub use evidence::{EvidenceIndex, EvidenceReport, EvidenceStore, copy_evidence_artifact};
pub use feature::{NewSpecOptions, create_spec};
pub use init::{InitOptions, initialize};
pub use kit::{
    DISTRIBUTION_VERSION, KitLock, UpgradeAction, UpgradeEntry, UpgradeReport, upgrade_kit,
};
pub use model::{
    ControlMode, Criterion, Event, EventKind, EvidenceKind, EvidenceRecord, Phase, PhaseOutcome,
    PhaseResult, Profile, State, Verdict, WorkflowStatus,
};
pub use repository::{RepositorySnapshot, SddRepository};
pub use workspace::workspace_hash;
