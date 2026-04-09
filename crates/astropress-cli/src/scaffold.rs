use std::fs;
use std::path::Path;

use include_dir::{include_dir, Dir};

use crate::utils::io_error;

pub(crate) static SCAFFOLD_TEMPLATE: Dir<'static> =
    include_dir!("$CARGO_MANIFEST_DIR/../../examples/github-pages");

pub(crate) fn write_embedded_template(dest: &Path) -> Result<(), String> {
    write_embedded_dir(&SCAFFOLD_TEMPLATE, dest)
}

fn write_embedded_dir(dir: &Dir, dest: &Path) -> Result<(), String> {
    for entry in dir.entries() {
        match entry {
            include_dir::DirEntry::File(f) => {
                let path = dest.join(f.path());
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
