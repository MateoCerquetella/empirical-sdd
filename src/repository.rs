use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use fs2::FileExt;
use sha2::{Digest, Sha256};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;
use ulid::Ulid;

use crate::config::Config;
use crate::error::{Result, SddError};
use crate::legacy::{ParsedState, parse_state, render_state};
use crate::model::{
    Event, EventKind, Phase, Profile, SCHEMA_VERSION, State, WorkflowStatus, valid_identity,
};
use crate::spec::{read_acceptance_criteria, sha256_file, validate_relative_path};

pub const AI_DIRECTORY: &str = "ai";
pub const STATE_FILE: &str = "STATE.md";
pub const CONFIG_FILE: &str = "empirical.toml";
pub const EVENTS_DIRECTORY: &str = "events";

#[derive(Debug, Clone)]
pub struct SddRepository {
    root: PathBuf,
}

#[derive(Debug, Clone)]
pub struct RepositorySnapshot {
    pub config: Config,
    pub state: State,
    pub legacy: bool,
}

impl SddRepository {
    pub fn discover(start: impl AsRef<Path>) -> Result<Self> {
        let start = start.as_ref();
        let mut current = if start.is_file() {
            start.parent().unwrap_or(start).to_path_buf()
        } else {
            start.to_path_buf()
        };
        if current.as_os_str().is_empty() {
            current = PathBuf::from(".");
        }
        loop {
            let ai = current.join(AI_DIRECTORY);
            if ai.join(STATE_FILE).is_file()
                || (ai.join(CONFIG_FILE).is_file() && ai.join(EVENTS_DIRECTORY).is_dir())
            {
                return Self::from_root(current);
            }
            if !current.pop() {
                break;
            }
        }
        Err(SddError::RepositoryNotFound(start.to_path_buf()))
    }

    pub fn from_root(root: impl AsRef<Path>) -> Result<Self> {
        let root = root
            .as_ref()
            .canonicalize()
            .map_err(|error| SddError::io(root.as_ref(), error))?;
        let ai = root.join(AI_DIRECTORY);
        if !(ai.join(STATE_FILE).is_file()
            || ai.join(CONFIG_FILE).is_file() && ai.join(EVENTS_DIRECTORY).is_dir())
        {
            return Err(SddError::MissingFile(ai.join(STATE_FILE)));
        }
        ensure_real_directory(&ai, &root)?;
        Ok(Self { root })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn ai_dir(&self) -> PathBuf {
        self.root.join(AI_DIRECTORY)
    }

    pub fn state_path(&self) -> PathBuf {
        self.ai_dir().join(STATE_FILE)
    }

    pub fn config_path(&self) -> PathBuf {
        self.ai_dir().join(CONFIG_FILE)
    }

    pub fn events_dir(&self) -> PathBuf {
        self.ai_dir().join(EVENTS_DIRECTORY)
    }

    pub fn spec_dir(&self, spec_id: &str) -> Result<PathBuf> {
        validate_relative_path(spec_id)?;
        if spec_id.contains('/') || spec_id.contains('\\') {
            return Err(SddError::InvalidSpec(format!(
                "spec id must be one directory name: '{spec_id}'"
            )));
        }
        let specs = self.ai_dir().join("specs");
        if specs.exists() {
            ensure_real_directory(&specs, &self.root)?;
        }
        let directory = specs.join(spec_id);
        if directory.exists() {
            ensure_real_directory(&directory, &self.root)?;
        }
        Ok(directory)
    }

    pub fn spec_path(&self, spec_id: &str) -> Result<PathBuf> {
        let path = self.spec_dir(spec_id)?.join("spec.md");
        if path.exists() {
            ensure_real_file(&path, &self.root)?;
        }
        Ok(path)
    }

    pub fn load_config(&self) -> Result<Config> {
        let path = self.config_path();
        if path.is_file() {
            ensure_real_file(&path, &self.root)?;
            Config::from_path(&path)
        } else {
            Ok(Config::legacy_default())
        }
    }

    pub fn load_state(&self) -> Result<ParsedState> {
        let config = self.load_config()?;
        let path = self.state_path();
        ensure_real_file(&path, &self.root)?;
        let text = fs::read_to_string(&path).map_err(|error| SddError::io(&path, error))?;
        let legacy_id = self.legacy_project_id();
        parse_state(&text, config.profile, legacy_id)
    }

    pub fn snapshot(&self) -> Result<RepositorySnapshot> {
        let config = self.load_config()?;
        let parsed = self.load_state()?;
        Ok(RepositorySnapshot {
            config,
            state: parsed.state,
            legacy: parsed.legacy,
        })
    }

    pub fn current_criteria(&self, state: &State) -> Result<Vec<crate::model::Criterion>> {
        let spec = state
            .current_spec
            .as_deref()
            .ok_or_else(|| SddError::InvalidState("no current spec is selected".into()))?;
        let path = self.spec_path(spec)?;
        if !path.is_file() {
            return Err(SddError::MissingFile(path));
        }
        read_acceptance_criteria(&path)
    }

    pub fn write_config(&self, config: &Config) -> Result<()> {
        let encoded = config.to_toml()?;
        atomic_write(&self.config_path(), encoded.as_bytes())
    }

    pub fn adopt(&self, requested_profile: Option<Profile>, actor: &str) -> Result<State> {
        if !valid_identity(actor) {
            return Err(SddError::InvalidState(
                "invalid adoption actor identity".into(),
            ));
        }
        let _lock = self.lock()?;
        let config_exists = self.config_path().is_file();
        if let Some(recovered) = self.reconstruct_event_state()? {
            let preserved_notes = self
                .load_state()
                .ok()
                .and_then(|parsed| parsed.preserved_notes);
            let mut config = if config_exists {
                self.load_config()?
            } else {
                Config::default()
            };
            config.profile = recovered.profile;
            self.write_config(&config)?;
            atomic_write(
                &self.state_path(),
                render_state(&recovered, preserved_notes.as_deref()).as_bytes(),
            )?;
            return Ok(recovered);
        }
        let parsed = self.load_state()?;
        if config_exists && !parsed.legacy && parsed.state.revision > 0 {
            return Ok(parsed.state);
        }

        let profile = requested_profile.unwrap_or(if parsed.legacy {
            Profile::Strong
        } else {
            parsed.state.profile
        });
        let mut config = if config_exists {
            self.load_config()?
        } else if parsed.legacy {
            Config::legacy_default()
        } else {
            Config::default()
        };
        config.profile = profile;
        config.validate()?;

        let mut state = parsed.state;
        state.project_id = format!("PRJ-{}", Ulid::new());
        state.profile = profile;
        state.spec_hash = state
            .current_spec
            .as_deref()
            .map(|spec_id| self.spec_path(spec_id).and_then(|path| sha256_file(&path)))
            .transpose()?;
        state.revision = 1;
        state.status = if state.phase == Phase::Done {
            WorkflowStatus::Done
        } else if state.phase == Phase::Idle {
            WorkflowStatus::Idle
        } else {
            WorkflowStatus::Waiting
        };
        state.message = Some("Repository adopted into Empirical SDD v2".into());
        let event_id = Ulid::new().to_string();
        state.last_event = Some(event_id.clone());
        state.validate()?;
        let event = Event {
            schema_version: SCHEMA_VERSION,
            id: event_id,
            occurred_at: now()?,
            expected_revision: 0,
            revision: 1,
            kind: EventKind::Adopted,
            actor: actor.into(),
            summary: "Adopted repository without renaming v1 artifacts".into(),
            previous_event: None,
            state: state.clone(),
        };

        fs::create_dir_all(self.events_dir())
            .map_err(|error| SddError::io(self.events_dir(), error))?;
        self.write_config(&config)?;
        write_event(&self.events_dir(), &event)?;
        atomic_write(
            &self.state_path(),
            render_state(&state, parsed.preserved_notes.as_deref()).as_bytes(),
        )?;
        Ok(state)
    }

    pub fn select_spec(
        &self,
        spec_id: &str,
        profile: Option<Profile>,
        expected_revision: u64,
        actor: &str,
    ) -> Result<State> {
        let spec_path = self.spec_path(spec_id)?;
        if !spec_path.is_file() {
            return Err(SddError::MissingFile(spec_path));
        }
        self.transition(
            expected_revision,
            EventKind::SpecSelected,
            actor,
            &format!("Selected spec {spec_id}"),
            |state, config| {
                if let Some(profile) = profile {
                    state.profile = profile;
                } else {
                    state.profile = config.profile;
                }
                state.current_spec = Some(spec_id.into());
                state.phase = Phase::first(state.profile);
                state.status = WorkflowStatus::Waiting;
                state.repair_attempts = 0;
                state.spec_revision = state.spec_revision.checked_add(1).ok_or_else(|| {
                    SddError::InvalidState("spec revision counter overflow".into())
                })?;
                state.spec_hash = Some(sha256_file(&spec_path)?);
                state.message = None;
                Ok(())
            },
        )
    }

    pub fn synchronize_spec_revision(&self, actor: &str) -> Result<State> {
        let state = self.reconcile()?;
        let Some(spec_id) = state.current_spec.as_deref() else {
            return Ok(state);
        };
        let current_hash = sha256_file(&self.spec_path(spec_id)?)?;
        if state.spec_hash.as_deref() == Some(current_hash.as_str()) {
            return Ok(state);
        }
        let expected = state.revision;
        self.transition(
            expected,
            EventKind::SpecChanged,
            actor,
            "Specification content changed; downstream evidence was invalidated",
            |state, _| {
                state.spec_hash = Some(current_hash);
                state.spec_revision = state.spec_revision.checked_add(1).ok_or_else(|| {
                    SddError::InvalidState("spec revision counter overflow".into())
                })?;
                state.phase = Phase::first(state.profile);
                state.status = WorkflowStatus::Waiting;
                state.repair_attempts = 0;
                state.implementation_actor = None;
                state.message = Some(
                    "Specification changed; workflow restarted and prior evidence is stale".into(),
                );
                Ok(())
            },
        )
    }

    pub fn transition<F>(
        &self,
        expected_revision: u64,
        kind: EventKind,
        actor: &str,
        summary: &str,
        update: F,
    ) -> Result<State>
    where
        F: FnOnce(&mut State, &Config) -> Result<()>,
    {
        if !valid_identity(actor) {
            return Err(SddError::InvalidState(
                "invalid transition actor identity".into(),
            ));
        }
        let _lock = self.lock()?;
        let config = self.load_config()?;
        if !self.config_path().is_file() {
            return Err(SddError::InvalidState(
                "legacy repository must be adopted before mutation".into(),
            ));
        }
        let mut state = self.reconcile_projection_locked()?;
        let preserved_notes = self.load_state()?.preserved_notes;
        if state.revision != expected_revision {
            return Err(SddError::StaleRevision {
                expected: expected_revision,
                actual: state.revision,
            });
        }
        let previous_event = state.last_event.clone();
        update(&mut state, &config)?;
        state.revision = expected_revision
            .checked_add(1)
            .ok_or_else(|| SddError::InvalidState("state revision counter overflow".into()))?;
        let event_id = Ulid::new().to_string();
        state.last_event = Some(event_id.clone());
        state.validate()?;
        let event = Event {
            schema_version: SCHEMA_VERSION,
            id: event_id,
            occurred_at: now()?,
            expected_revision,
            revision: state.revision,
            kind,
            actor: actor.into(),
            summary: summary.into(),
            previous_event,
            state: state.clone(),
        };
        fs::create_dir_all(self.events_dir())
            .map_err(|error| SddError::io(self.events_dir(), error))?;
        write_event(&self.events_dir(), &event)?;
        atomic_write(
            &self.state_path(),
            render_state(&state, preserved_notes.as_deref()).as_bytes(),
        )?;
        Ok(state)
    }

    pub fn events(&self) -> Result<Vec<Event>> {
        let directory = self.events_dir();
        if !directory.is_dir() {
            return Ok(Vec::new());
        }
        ensure_real_directory(&directory, &self.root)?;
        let mut events = Vec::new();
        for entry in fs::read_dir(&directory).map_err(|error| SddError::io(&directory, error))? {
            let entry = entry.map_err(|error| SddError::io(&directory, error))?;
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("json") {
                continue;
            }
            ensure_real_file(&path, &self.root)?;
            let bytes = fs::read(&path).map_err(|error| SddError::io(&path, error))?;
            let event: Event = serde_json::from_slice(&bytes)?;
            if event.schema_version != SCHEMA_VERSION
                || event.id.trim().is_empty()
                || !valid_identity(&event.actor)
                || event.summary.trim().is_empty()
                || OffsetDateTime::parse(&event.occurred_at, &Rfc3339).is_err()
                || event.expected_revision.checked_add(1) != Some(event.revision)
                || event.state.revision != event.revision
                || event.state.last_event.as_deref() != Some(event.id.as_str())
                || event.state.validate().is_err()
            {
                return Err(SddError::InvalidState(format!(
                    "invalid event {}",
                    path.display()
                )));
            }
            events.push(event);
        }
        events.sort_by(|left, right| {
            left.revision
                .cmp(&right.revision)
                .then_with(|| left.id.cmp(&right.id))
        });
        Ok(events)
    }

    pub fn recover(&self) -> Result<State> {
        let _lock = self.lock()?;
        let preserved_notes = self
            .load_state()
            .ok()
            .and_then(|parsed| parsed.preserved_notes);
        let recovered = self.reconstruct_event_state()?.ok_or_else(|| {
            SddError::InvalidState("no portable events are available for recovery".into())
        })?;
        atomic_write(
            &self.state_path(),
            render_state(&recovered, preserved_notes.as_deref()).as_bytes(),
        )?;
        Ok(recovered)
    }

    /// Returns state coherent with the event journal. If a process stopped
    /// after its event became durable but before STATE.md was projected, the
    /// missing projection is repaired automatically.
    pub fn reconcile(&self) -> Result<State> {
        let _lock = self.lock()?;
        self.reconcile_projection_locked()
    }

    fn reconcile_projection_locked(&self) -> Result<State> {
        let projected = self.load_state();
        let Some(event_state) = self.reconstruct_event_state()? else {
            return Ok(projected?.state);
        };
        let preserved_notes = match projected {
            Ok(parsed) if parsed.state.revision > event_state.revision => {
                return Err(SddError::InvalidState(format!(
                    "STATE.md revision {} is ahead of event revision {}",
                    parsed.state.revision, event_state.revision
                )));
            }
            Ok(parsed) if parsed.state.revision == event_state.revision => {
                if parsed.state != event_state {
                    return Err(SddError::InvalidState(
                        "STATE.md disagrees with the event at the same revision; run `empirical recover` to restore the event projection".into(),
                    ));
                }
                return Ok(parsed.state);
            }
            Ok(parsed) => parsed.preserved_notes,
            Err(_) => None,
        };
        atomic_write(
            &self.state_path(),
            render_state(&event_state, preserved_notes.as_deref()).as_bytes(),
        )?;
        Ok(event_state)
    }

    fn reconstruct_event_state(&self) -> Result<Option<State>> {
        let events = self.events()?;
        if events.is_empty() {
            return Ok(None);
        }
        let mut by_expected: BTreeMap<u64, Vec<&Event>> = BTreeMap::new();
        for event in &events {
            by_expected
                .entry(event.expected_revision)
                .or_default()
                .push(event);
        }
        for (revision, candidates) in &by_expected {
            if candidates.len() > 1 {
                return Err(SddError::EventFork {
                    revision: *revision,
                    events: candidates.iter().map(|event| event.id.clone()).collect(),
                });
            }
        }
        let mut expected = 0;
        let mut previous: Option<String> = None;
        let mut recovered: Option<State> = None;
        while let Some(event) = by_expected.get(&expected).and_then(|events| events.first()) {
            if expected.checked_add(1) != Some(event.revision) || event.previous_event != previous {
                return Err(SddError::InvalidState(format!(
                    "event {} does not extend the linear history",
                    event.id
                )));
            }
            expected = event.revision;
            previous = Some(event.id.clone());
            recovered = Some(event.state.clone());
        }
        let recovered = recovered.ok_or_else(|| {
            SddError::InvalidState("event history does not begin at revision zero".into())
        })?;
        if expected as usize != events.len() {
            return Err(SddError::InvalidState(
                "event history contains a disconnected transition".into(),
            ));
        }
        recovered.validate()?;
        Ok(Some(recovered))
    }

    pub(crate) fn with_coherent_lock<T>(
        &self,
        operation: impl FnOnce(&State) -> Result<T>,
    ) -> Result<T> {
        let _lock = self.lock()?;
        let state = self.reconcile_projection_locked()?;
        operation(&state)
    }

    fn legacy_project_id(&self) -> String {
        let digest = Sha256::digest(self.root.to_string_lossy().as_bytes());
        format!("legacy-{}", &hex::encode(digest)[..16])
    }

    fn lock(&self) -> Result<RepositoryLock> {
        let directory = std::env::temp_dir().join("empirical-sdd-locks");
        fs::create_dir_all(&directory).map_err(|error| SddError::io(&directory, error))?;
        let digest = Sha256::digest(self.root.to_string_lossy().as_bytes());
        let path = directory.join(format!("{}.lock", hex::encode(digest)));
        let file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(&path)
            .map_err(|error| SddError::io(&path, error))?;
        file.lock_exclusive()
            .map_err(|error| SddError::io(&path, error))?;
        Ok(RepositoryLock { file })
    }
}

struct RepositoryLock {
    file: File,
}

impl Drop for RepositoryLock {
    fn drop(&mut self) {
        let _ = FileExt::unlock(&self.file);
    }
}

pub(crate) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| SddError::InvalidState(format!("{} has no parent", path.display())))?;
    fs::create_dir_all(parent).map_err(|error| SddError::io(parent, error))?;
    let temporary = parent.join(format!(
        ".{}.{}.tmp",
        path.file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("empirical"),
        Ulid::new()
    ));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|error| SddError::io(&temporary, error))?;
    file.write_all(bytes)
        .map_err(|error| SddError::io(&temporary, error))?;
    file.sync_all()
        .map_err(|error| SddError::io(&temporary, error))?;
    match fs::rename(&temporary, path) {
        Ok(()) => {}
        Err(_error) if cfg!(windows) && path.is_file() => {
            fs::remove_file(path).map_err(|remove| SddError::io(path, remove))?;
            fs::rename(&temporary, path).map_err(|rename| SddError::io(path, rename))?;
        }
        Err(error) => return Err(SddError::io(path, error)),
    }
    sync_directory(parent)?;
    Ok(())
}

fn ensure_real_directory(path: &Path, root: &Path) -> Result<()> {
    let canonical = path
        .canonicalize()
        .map_err(|error| SddError::io(path, error))?;
    if canonical != path || !canonical.starts_with(root) || !canonical.is_dir() {
        return Err(SddError::InvalidState(format!(
            "repository directory must be a contained non-symlink directory: {}",
            path.display()
        )));
    }
    Ok(())
}

fn ensure_real_file(path: &Path, root: &Path) -> Result<()> {
    let canonical = path
        .canonicalize()
        .map_err(|error| SddError::io(path, error))?;
    if canonical != path || !canonical.starts_with(root) || !canonical.is_file() {
        return Err(SddError::InvalidState(format!(
            "repository file must be a contained non-symlink file: {}",
            path.display()
        )));
    }
    Ok(())
}

fn write_event(directory: &Path, event: &Event) -> Result<()> {
    let destination = directory.join(format!("{}-{:020}.json", event.id, event.revision));
    let bytes = serde_json::to_vec_pretty(event)?;
    let temporary = directory.join(format!(".{}.tmp", Ulid::new()));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|error| SddError::io(&temporary, error))?;
    file.write_all(&bytes)
        .map_err(|error| SddError::io(&temporary, error))?;
    file.sync_all()
        .map_err(|error| SddError::io(&temporary, error))?;
    fs::rename(&temporary, &destination).map_err(|error| SddError::io(&destination, error))?;
    sync_directory(directory)?;
    Ok(())
}

fn sync_directory(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        File::open(path)
            .and_then(|directory| directory.sync_all())
            .map_err(|error| SddError::io(path, error))?;
    }
    Ok(())
}

pub fn now() -> Result<String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| SddError::InvalidState(format!("could not format timestamp: {error}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn fixture() -> tempfile::TempDir {
        let directory = tempfile::tempdir().unwrap();
        fs::create_dir_all(directory.path().join("ai/specs/001-example")).unwrap();
        fs::write(
            directory.path().join("ai/STATE.md"),
            "# State\ncurrent_spec: 001-example\ncurrent_role: developer\ncurrent_phase: dev\nmode: autonomous\n\n## Recent decisions\n\n- Keep this history.\n",
        )
        .unwrap();
        fs::write(
            directory.path().join("ai/specs/001-example/spec.md"),
            "# Example\n\n## Acceptance Criteria\n\n- [ ] It returns a result\n",
        )
        .unwrap();
        directory
    }

    #[test]
    fn discovery_is_read_only_for_v1() {
        let directory = fixture();
        let state_path = directory.path().join("ai/STATE.md");
        let before = fs::read(&state_path).unwrap();
        let repository = SddRepository::discover(directory.path().join("ai/specs")).unwrap();
        let snapshot = repository.snapshot().unwrap();
        assert!(snapshot.legacy);
        assert_eq!(snapshot.state.phase, Phase::Implement);
        assert_eq!(fs::read(state_path).unwrap(), before);
        assert!(!directory.path().join("ai/empirical.toml").exists());
    }

    #[test]
    fn adoption_preserves_v1_content_and_adds_portable_state() {
        let directory = fixture();
        let repository = SddRepository::from_root(directory.path()).unwrap();
        let state = repository.adopt(None, "test").unwrap();
        assert_eq!(state.profile, Profile::Strong);
        assert_eq!(state.revision, 1);
        let rendered = fs::read_to_string(repository.state_path()).unwrap();
        assert!(rendered.contains("Preserved pre-v2 state"));
        assert!(rendered.contains("current_phase: dev"));
        assert!(repository.config_path().is_file());
        assert_eq!(repository.events().unwrap().len(), 1);

        repository
            .transition(1, EventKind::PhaseStarted, "test", "start", |state, _| {
                state.status = WorkflowStatus::Running;
                Ok(())
            })
            .unwrap();
        let transitioned = fs::read_to_string(repository.state_path()).unwrap();
        assert!(transitioned.contains("## Recent decisions"));
        assert!(transitioned.contains("- Keep this history."));
    }

    #[test]
    fn stale_revision_cannot_overwrite_state() {
        let directory = fixture();
        let repository = SddRepository::from_root(directory.path()).unwrap();
        repository.adopt(None, "test").unwrap();
        repository
            .transition(1, EventKind::PhaseStarted, "one", "start", |state, _| {
                state.status = WorkflowStatus::Running;
                Ok(())
            })
            .unwrap();
        let error = repository
            .transition(1, EventKind::PhasePassed, "two", "stale", |_, _| Ok(()))
            .unwrap_err();
        assert!(matches!(error, SddError::StaleRevision { actual: 2, .. }));
    }

    #[test]
    fn recover_reprojects_state_from_events() {
        let directory = fixture();
        let repository = SddRepository::from_root(directory.path()).unwrap();
        repository.adopt(None, "test").unwrap();
        let advanced = repository
            .transition(1, EventKind::PhaseStarted, "test", "running", |state, _| {
                state.status = WorkflowStatus::Running;
                Ok(())
            })
            .unwrap();
        fs::write(repository.state_path(), "corrupt").unwrap();
        let recovered = repository.recover().unwrap();
        assert_eq!(recovered, advanced);
        assert_eq!(repository.load_state().unwrap().state, advanced);
    }

    #[test]
    fn transition_reconciles_a_durable_event_before_rejecting_a_retry() {
        let directory = fixture();
        let repository = SddRepository::from_root(directory.path()).unwrap();
        let adopted = repository.adopt(None, "test").unwrap();
        let advanced = repository
            .transition(
                adopted.revision,
                EventKind::PhaseStarted,
                "test",
                "running",
                |state, _| {
                    state.status = WorkflowStatus::Running;
                    Ok(())
                },
            )
            .unwrap();

        // Simulate a process that durably wrote the event and stopped before
        // its newer STATE.md projection became visible.
        atomic_write(
            &repository.state_path(),
            render_state(&adopted, None).as_bytes(),
        )
        .unwrap();
        let error = repository
            .transition(
                adopted.revision,
                EventKind::PhaseStarted,
                "retry",
                "retry",
                |_, _| Ok(()),
            )
            .unwrap_err();
        assert!(matches!(
            error,
            SddError::StaleRevision {
                actual,
                ..
            } if actual == advanced.revision
        ));
        assert_eq!(repository.load_state().unwrap().state, advanced);
        assert_eq!(repository.events().unwrap().len(), 2);
    }

    #[cfg(unix)]
    #[test]
    fn repository_rejects_a_symlinked_protocol_directory() {
        use std::os::unix::fs::symlink;

        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("STATE.md"), "current_spec: none\n").unwrap();
        symlink(outside.path(), root.path().join("ai")).unwrap();

        assert!(SddRepository::from_root(root.path()).is_err());
    }
}
