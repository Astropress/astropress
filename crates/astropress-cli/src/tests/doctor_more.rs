use std::fs;

use super::temp_dir;
use crate::commands::doctor::inspect_project_health;

#[test]
fn doctor_warns_about_unsupported_app_host_data_services_pair() {
    // Kills `delete match arm "unsupported"` at doctor.rs:143.
    // (github-pages, neon) is not in the supported or preview lists → "unsupported".
    // "unknown-host" is not in the JS resolver's recognised list and defaults to
    // "github-pages", so we use a known host with an unrecognised pair instead.
    let root = temp_dir("doctor-unsupported");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_APP_HOST=github-pages",
            "ASTROPRESS_CONTENT_SERVICES=neon",
            "ASTROPRESS_SERVICE_ORIGIN=https://example.com/astropress",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        report.warnings.iter().any(|w| w.contains("not a first-party supported")),
        "github-pages+neon must produce an 'unsupported' warning; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_no_unsupported_adapter_warning_for_known_content_services() {
    // Kills `!= -> ==` mutations at doctor.rs:150-153 for "supabase".
    let root = temp_dir("doctor-known-cs");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_CONTENT_SERVICES=supabase",
            "ASTROPRESS_SERVICE_ORIGIN=https://proj.supabase.co/functions/v1/astropress",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        !report.warnings.iter().any(|w| w.contains("does not yet provide")),
        "supabase content services must not warn about missing adapter; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_warns_about_unknown_content_services_adapter() {
    // Kills `&& -> ||` mutations at doctor.rs:151-153 — verifies the block fires for unknown services.
    // "custom-unknown" is not in the JS resolver's recognised list and defaults to "none";
    // use "neon" which IS recognised but is not in the doctor.rs first-party whitelist.
    let root = temp_dir("doctor-unknown-cs");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_APP_HOST=github-pages",
            "ASTROPRESS_CONTENT_SERVICES=neon",
            "ASTROPRESS_SERVICE_ORIGIN=https://example.com/astropress",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        report.warnings.iter().any(|w| w.contains("does not yet provide")),
        "neon content services must warn about missing first-party adapter; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_no_webhook_warning_without_formbricks_or_typebot_urls() {
    // Kills `&& -> ||` at doctor.rs:164.
    // With mutation: `(A||B||C) || (!D && !E)` fires when D and E are both absent.
    // Original: `(A||B||C) && !D && !E` does NOT fire when A/B/C are absent.
    // Test: no Formbricks/Typebot URLs, no webhook secrets — assert no webhook warning.
    let root = temp_dir("doctor-no-formbricks");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_CONTENT_SERVICES=none",
            "ASTROPRESS_APP_HOST=github-pages",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        !report.warnings.iter().any(|w| w.contains("TYPEBOT_WEBHOOK_SECRET")),
        "no Formbricks/Typebot URLs means no webhook warning; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_no_webhook_warning_when_typebot_secret_set() {
    // Kills `&& -> ||` at doctor.rs:165.
    // Original: `(A||B||C) && !D && !E` — fires only when BOTH D and E absent.
    // With mutation: `((A||B||C) && !D) || !E` fires when D absent (even if E set).
    // Test: FORMBRICKS_URL set, FORMBRICKS_WEBHOOK_SECRET absent, TYPEBOT_WEBHOOK_SECRET set
    //   → original: no warn (E present makes line 165 false)
    //   → mutation: warns (FORMBRICKS_URL + no FORMBRICKS_WEBHOOK_SECRET → true)
    let root = temp_dir("doctor-typebot-secret");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_CONTENT_SERVICES=none",
            "ASTROPRESS_APP_HOST=github-pages",
            "FORMBRICKS_URL=https://app.formbricks.com",
            "TYPEBOT_WEBHOOK_SECRET=my-typebot-secret",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        !report.warnings.iter().any(|w| w.contains("TYPEBOT_WEBHOOK_SECRET")),
        "TYPEBOT_WEBHOOK_SECRET set must suppress webhook warning; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_warns_formbricks_api_key_only() {
    // Kills `||→&&` at doctor.rs:162:9.
    // Mutation changes `|| FORMBRICKS_API_KEY` to `&& FORMBRICKS_API_KEY`, requiring
    // FORMBRICKS_URL to also be present. With only FORMBRICKS_API_KEY, the original warns.
    let root = temp_dir("doctor-fb-api-key");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_CONTENT_SERVICES=none",
            "ASTROPRESS_APP_HOST=github-pages",
            "FORMBRICKS_API_KEY=test-api-key",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        report.warnings.iter().any(|w| w.contains("TYPEBOT_WEBHOOK_SECRET")),
        "FORMBRICKS_API_KEY alone must trigger webhook warning; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_warns_typebot_url_only() {
    // Kills `||→&&` at doctor.rs:163:9.
    // Mutation changes `|| TYPEBOT_URL` to `&& TYPEBOT_URL`, requiring both
    // FORMBRICKS_URL and FORMBRICKS_API_KEY. With only TYPEBOT_URL, original warns.
    let root = temp_dir("doctor-typebot-url");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_CONTENT_SERVICES=none",
            "ASTROPRESS_APP_HOST=github-pages",
            "TYPEBOT_URL=https://typebot.io",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        report.warnings.iter().any(|w| w.contains("TYPEBOT_WEBHOOK_SECRET")),
        "TYPEBOT_URL alone must trigger webhook warning; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_no_webhook_warning_when_formbricks_secret_set() {
    // Kills `delete !` at doctor.rs:164:12.
    // Mutation changes `!contains(FORMBRICKS_WEBHOOK_SECRET)` to `contains(...)`.
    // With FORMBRICKS_URL + FORMBRICKS_WEBHOOK_SECRET: original condition is false (no warn).
    // Mutation makes it true → warns → test fails → mutation caught.
    let root = temp_dir("doctor-fb-secret");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_CONTENT_SERVICES=none",
            "ASTROPRESS_APP_HOST=github-pages",
            "FORMBRICKS_URL=https://app.formbricks.com",
            "FORMBRICKS_WEBHOOK_SECRET=my-formbricks-secret",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        !report.warnings.iter().any(|w| w.contains("TYPEBOT_WEBHOOK_SECRET")),
        "FORMBRICKS_WEBHOOK_SECRET set must suppress webhook warning; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_no_admin_db_warning_when_data_dir_exists() {
    // Kills `delete !` at doctor.rs:182:12.
    // `admin_db_parent_existed` is captured AFTER load_project_launch_plan, which creates
    // .data/ as a side effect. So when .data/ exists, admin_db_parent_existed = true.
    // Original: `if !true` = false → no "admin database directory" warning.
    // Mutation `delete !`: `if true` → warning added → assert fails → mutation caught.
    let root = temp_dir("doctor-admin-db-parent-exists");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_CONTENT_SERVICES=none",
            "ASTROPRESS_APP_HOST=github-pages",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        !report.warnings.iter().any(|w| w.contains("admin database directory")),
        "data dir exists → must NOT warn about admin database directory; warnings: {:?}",
        report.warnings
    );
}
