use std::path::Path;

use crate::js_bridge::loaders::{run_content_services_operation, ContentServicesReport};

pub(crate) use crate::commands::import_common::{
    bootstrap_content_services, print_content_services_report,
};

pub(crate) fn verify_content_services(
    project_dir: &Path,
) -> Result<ContentServicesReport, String> {
    run_content_services_operation(project_dir, "verifyAstropressContentServices")
}
