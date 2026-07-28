//! Deterministic source snapshots used to bind evidence to tested work.

use std::ffi::OsStr;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Component, Path, PathBuf};

use ignore::WalkBuilder;
use sha2::{Digest, Sha256};

use crate::error::{Result, SddError};

/// Hashes every non-ignored regular file and symlink outside the protocol's
/// mutable `ai/` projection. Git ignore rules are honored so build outputs and
/// local caches do not invalidate evidence.
pub fn workspace_hash(root: &Path) -> Result<String> {
    let root = root
        .canonicalize()
        .map_err(|error| SddError::io(root, error))?;
    let filter_root = root.clone();
    let mut builder = WalkBuilder::new(&root);
    builder
        .hidden(false)
        .parents(false)
        .ignore(true)
        .git_ignore(true)
        .git_global(false)
        .git_exclude(false)
        .require_git(false)
        .filter_entry(move |entry| {
            if entry.depth() == 0 {
                return true;
            }
            let Ok(relative) = entry.path().strip_prefix(&filter_root) else {
                return false;
            };
            let mut components = relative.components();
            match components.next() {
                Some(Component::Normal(name)) if name == OsStr::new("ai") => {
                    components.next().is_none() || relative == Path::new("ai/empirical.toml")
                }
                Some(Component::Normal(name))
                    if name == OsStr::new(".git") || name == OsStr::new("target") =>
                {
                    false
                }
                _ => true,
            }
        });

    let mut paths = Vec::<(String, PathBuf)>::new();
    for entry in builder.build() {
        let entry = entry.map_err(|error| {
            SddError::InvalidState(format!("could not walk workspace for evidence: {error}"))
        })?;
        if entry.depth() > 0
            && entry
                .file_type()
                .is_some_and(|kind| kind.is_file() || kind.is_symlink())
        {
            let path = entry.into_path();
            let relative = path.strip_prefix(&root).map_err(|_| {
                SddError::InvalidState(format!(
                    "workspace entry escaped repository: {}",
                    path.display()
                ))
            })?;
            paths.push((relative.to_string_lossy().replace('\\', "/"), path));
        }
    }
    paths.sort_by(|left, right| left.0.cmp(&right.0));

    let mut digest = Sha256::new();
    digest.update(b"empirical-workspace-v1\0");
    for (normalized, path) in paths {
        update_field(&mut digest, normalized.as_bytes());

        let metadata = fs::symlink_metadata(&path).map_err(|error| SddError::io(&path, error))?;
        if metadata.file_type().is_symlink() {
            digest.update(b"symlink\0");
            let target = fs::read_link(&path).map_err(|error| SddError::io(&path, error))?;
            update_field(
                &mut digest,
                target.to_string_lossy().replace('\\', "/").as_bytes(),
            );
        } else {
            digest.update(b"file\0");
            update_file(&mut digest, &path, metadata.len())?;
        }
    }
    Ok(format!("sha256:{}", hex::encode(digest.finalize())))
}

fn update_field(digest: &mut Sha256, bytes: &[u8]) {
    digest.update((bytes.len() as u64).to_le_bytes());
    digest.update(bytes);
}

fn update_file(digest: &mut Sha256, path: &Path, length: u64) -> Result<()> {
    digest.update(length.to_le_bytes());
    let mut file = File::open(path).map_err(|error| SddError::io(path, error))?;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| SddError::io(path, error))?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workflow_state_is_excluded_but_source_changes_invalidate_the_hash() {
        let directory = tempfile::tempdir().unwrap();
        fs::create_dir_all(directory.path().join("ai/events")).unwrap();
        fs::write(directory.path().join(".gitignore"), "generated.log\n").unwrap();
        fs::write(directory.path().join("src.txt"), "one\n").unwrap();
        fs::write(directory.path().join("generated.log"), "generated one\n").unwrap();
        fs::write(
            directory.path().join("ai/empirical.toml"),
            "profile = \"quick\"\n",
        )
        .unwrap();
        fs::write(directory.path().join("ai/STATE.md"), "revision one\n").unwrap();
        let initial = workspace_hash(directory.path()).unwrap();

        fs::write(directory.path().join("ai/STATE.md"), "revision two\n").unwrap();
        fs::write(directory.path().join("generated.log"), "generated two\n").unwrap();
        assert_eq!(workspace_hash(directory.path()).unwrap(), initial);

        fs::write(
            directory.path().join("ai/empirical.toml"),
            "profile = \"strong\"\n",
        )
        .unwrap();
        assert_ne!(workspace_hash(directory.path()).unwrap(), initial);
        fs::write(
            directory.path().join("ai/empirical.toml"),
            "profile = \"quick\"\n",
        )
        .unwrap();

        fs::write(directory.path().join("src.txt"), "two\n").unwrap();
        assert_ne!(workspace_hash(directory.path()).unwrap(), initial);
    }
}
