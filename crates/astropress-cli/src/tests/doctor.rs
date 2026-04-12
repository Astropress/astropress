use std::fs;

use super::temp_dir;
use crate::commands::doctor::inspect_project_health;

#[test]
fn doctor_reports_missing_local_runtime_warnings() {
    let root = temp_dir("doctor");
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert_eq!(report.launch_plan.runtime.mode, "local");
    assert!(report
        .warnings
        .iter()
        .any(|warning| warning.contains("SESSION_SECRET")));
    assert!(report
        .warnings
        .iter()
        .any(|warning| warning.contains("ADMIN_PASSWORD")));
    assert!(report
        .warnings
        .iter()
        .any(|warning| warning.contains("EDITOR_PASSWORD")));
    assert!(report
        .warnings
        .iter()
        .any(|warning| warning.contains("`.data` directory")));
    assert!(report
        .warnings
        .iter()
        .any(|warning| warning.contains("ADMIN_BOOTSTRAP_DISABLED")));
}

#[test]
fn doctor_flags_weak_or_scaffolded_secrets() {
    let root = temp_dir("doctor-secrets");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "SESSION_SECRET=short-secret",
            "ADMIN_PASSWORD=local-admin-demo",
            "EDITOR_PASSWORD=local-editor-demo",
            "ADMIN_BOOTSTRAP_DISABLED=0",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(report
        .warnings
        .iter()
        .any(|warning| warning.contains("shorter than 24 characters")));
    assert!(report
        .warnings
        .iter()
        .any(|warning| warning.contains("scaffold-style local default")));
    assert!(report
        .warnings
        .iter()
        .any(|warning| warning.contains("bootstrap passwords remain available")));
}
