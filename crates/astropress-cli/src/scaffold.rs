use std::fs;
use std::path::Path;

use include_dir::{include_dir, Dir};

use crate::error::CliResult;
use crate::utils::io_error;

pub(crate) static SCAFFOLD_TEMPLATE: Dir<'static> =
    include_dir!("$CARGO_MANIFEST_DIR/templates");

pub(crate) fn write_embedded_template(dest: &Path) -> CliResult<()> { // ~ skip
    write_embedded_dir(&SCAFFOLD_TEMPLATE, dest)
}

fn write_embedded_dir(dir: &Dir, dest: &Path) -> CliResult<()> {
    for entry in dir.entries() {
        match entry {
            include_dir::DirEntry::File(f) => {
                // Strip a `.tpl` suffix on emit. The suffix exists on
                // template files whose unsuffixed name (e.g. `biome.json`)
                // would otherwise be picked up by tooling traversing the
                // monorepo (biome 2 forbids nested root configs).
                let rel = f.path();
                let emit_path = match rel.to_str() {
                    Some(s) if s.ends_with(".tpl") => Path::new(&s[..s.len() - 4]).to_path_buf(),
                    _ => rel.to_path_buf(),
                };
                let path = dest.join(&emit_path);
                if let Some(parent) = path.parent() {
                    fs::create_dir_all(parent).map_err(io_error)?;
                }
                fs::write(&path, f.contents()).map_err(io_error)?;
            }
            include_dir::DirEntry::Dir(d) => {
                write_embedded_dir(d, dest)?;
            }
        }
    }
    Ok(())
}
