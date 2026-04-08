use std::fs;
use std::path::Path;

use crate::cli_config::env::{
    format_env_map, migrate_env_map, migrate_package_manifest_scripts, read_env_path,
    read_package_manifest, write_package_manifest,
};

pub(crate) fn migrate_project_config(project_dir: &Path, dry_run: bool) -> Result<usize, String> {
    let mut changed = 0;
    for file_name in [".env", ".env.example"] {
        let path = project_dir.join(file_name);
        if !path.exists() {
            continue;
        }
        let original = read_env_path(&path)?;
        let migrated = migrate_env_map(original.clone());
        if migrated != original {
            changed += 1;
            if !dry_run {
                fs::write(path, format_env_map(&migrated)).map_err(crate::io_error)?;
            }
        }
    }
    let package_json_path = project_dir.join("package.json");
    if package_json_path.exists() {
        let mut manifest = read_package_manifest(project_dir)?;
        if migrate_package_manifest_scripts(&mut manifest) {
            changed += 1;
            if !dry_run {
                write_package_manifest(project_dir, &manifest)?;
            }
        }
    }
    Ok(changed)
}
