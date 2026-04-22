use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::providers;

pub(crate) fn io_error(error: io::Error) -> String {
    error.to_string()
}

pub(crate) fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .unwrap()
        .to_path_buf()
}

/// Resolves the directory containing astropress's compiled JS modules.
/// `src/` is TypeScript-only; `tsc` emits to `dist/src/` at build time, and
/// that is where `node`/`bun` must import from via `file://…/<module>.js`.
///
/// Search order:
///   1. `{hint_project_dir}/node_modules/astropress/dist/src/`  (installed package)
///   2. Binary-relative ancestors (npm global install)
///   3. Dev fallback: `packages/astropress/dist/src/` (requires `bun run --filter astropress build`)
pub(crate) fn find_astropress_src(hint_project_dir: Option<&Path>) -> Option<PathBuf> { // ~ skip
    if let Some(dir) = hint_project_dir {
        let candidate = dir
            .join("node_modules")
            .join("astropress")
            .join("dist")
            .join("src");
        if candidate.exists() {
            return Some(candidate);
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        for ancestor in exe.ancestors().skip(1).take(4) {
            let candidate = ancestor
                .join("node_modules")
                .join("astropress")
                .join("dist")
                .join("src");
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    let dev_path = repo_root()
        .join("packages")
        .join("astropress")
        .join("dist")
        .join("src");
    if dev_path.exists() {
        return Some(dev_path);
    }
    None
}

pub(crate) fn sanitize_package_name(input: &str) -> String {
    let mut output = String::new();
    let mut last_dash = false;
    for ch in input.chars().flat_map(char::to_lowercase) {
        if ch.is_ascii_alphanumeric() {
            output.push(ch);
            last_dash = false;
        } else if !last_dash {
            output.push('-');
            last_dash = true;
        }
    }
    output.trim_matches('-').to_string()
}

pub(crate) fn write_text_file(
    project_dir: &Path,
    relative_path: &str,
    contents: &str,
) -> Result<(), String> { // ~ skip
    let destination = project_dir.join(relative_path);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(io_error)?;
    }
    fs::write(destination, contents).map_err(io_error)
}

pub(crate) fn ensure_local_provider_defaults(project_dir: &Path) -> Result<(), String> { // ~ skip
    let data_dir = project_dir.join(".data");
    fs::create_dir_all(&data_dir).map_err(io_error)?;
    let gitkeep_path = data_dir.join(".gitkeep");
    if !gitkeep_path.exists() {
        fs::write(&gitkeep_path, "").map_err(io_error)?;
    }
    Ok(())
}

pub(crate) fn default_admin_db_relative_path(
    provider: providers::LocalProvider,
) -> &'static str {
    provider.default_admin_db_relative_path()
}
