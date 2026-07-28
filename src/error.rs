use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum SddError {
    #[error("no Empirical SDD repository found from {0}")]
    RepositoryNotFound(PathBuf),
    #[error("missing required file: {0}")]
    MissingFile(PathBuf),
    #[error("invalid configuration: {0}")]
    InvalidConfig(String),
    #[error("invalid state: {0}")]
    InvalidState(String),
    #[error("invalid specification: {0}")]
    InvalidSpec(String),
    #[error("stale revision: expected {expected}, current revision is {actual}")]
    StaleRevision { expected: u64, actual: u64 },
    #[error("event history fork at expected revision {revision}: {events:?}")]
    EventFork { revision: u64, events: Vec<String> },
    #[error("required capability is unavailable: {0}")]
    MissingCapability(String),
    #[error("phase adapter for {0} is not configured")]
    MissingAdapter(String),
    #[error("command execution requires explicit caller authority")]
    ExecutionNotAuthorized,
    #[error("delivery action '{0}' requires explicit caller authority")]
    DeliveryNotAuthorized(String),
    #[error("delivery is unavailable before verification and review pass")]
    DeliveryBeforeReview,
    #[error("evidence gate failed: {0}")]
    EvidenceGate(String),
    #[error("adapter failed: {0}")]
    Adapter(String),
    #[error("delivery failed: {0}")]
    Delivery(String),
    #[error("I/O error at {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("TOML decode error: {0}")]
    TomlDecode(#[from] toml::de::Error),
    #[error("TOML encode error: {0}")]
    TomlEncode(#[from] toml::ser::Error),
}

impl SddError {
    pub fn io(path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        Self::Io {
            path: path.into(),
            source,
        }
    }
}

pub type Result<T> = std::result::Result<T, SddError>;
