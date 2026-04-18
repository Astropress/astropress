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

#[test]
fn doctor_session_secret_exactly_24_chars_is_not_flagged() {
    // Kills the `< -> <=` mutation at doctor.rs:56 — with <= 24, a 24-char secret warns; with <, it doesn't.
    let root = temp_dir("doctor-secret-len");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "SESSION_SECRET=exactly-24-chars-secrets", // exactly 24 chars
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        !report.warnings.iter().any(|w| w.contains("shorter than 24 characters")),
        "24-char SESSION_SECRET must not trigger length warning; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_no_turnstile_warning_for_local_runtime() {
    // Kills the `&& -> ||` and `!= -> ==` mutations at doctor.rs:91-92.
    // Local runtime mode should not require TURNSTILE_SECRET_KEY.
    let root = temp_dir("doctor-turnstile");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        !report.warnings.iter().any(|w| w.contains("TURNSTILE_SECRET_KEY")),
        "local runtime must not warn about TURNSTILE_SECRET_KEY; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_no_app_host_warning_when_app_host_is_set() {
    // Kills the `delete !` mutation at doctor.rs:99.
    let root = temp_dir("doctor-app-host");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_APP_HOST=github-pages",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        !report.warnings.iter().any(|w| w.contains("ASTROPRESS_APP_HOST is not set")),
        "ASTROPRESS_APP_HOST set must not warn about missing APP_HOST; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_no_content_services_warning_when_set() {
    // Kills `&& -> ||` and `delete !` mutations at doctor.rs:105-106.
    let root = temp_dir("doctor-content-services");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_CONTENT_SERVICES=none",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        !report.warnings.iter().any(|w| w.contains("ASTROPRESS_CONTENT_SERVICES is not set")),
        "ASTROPRESS_CONTENT_SERVICES set must not warn about missing CONTENT_SERVICES; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_no_content_services_warning_when_data_services_set() {
    // Kills `delete !` at doctor.rs:106:12.
    // Condition is: !contains(CONTENT_SERVICES) && !contains(DATA_SERVICES).
    // With CONTENT_SERVICES absent but DATA_SERVICES present:
    //   original: true && false → no warn ✓
    //   mutation (delete ! on line 106): true && true → warns → test fails → caught.
    let root = temp_dir("doctor-data-services");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_DATA_SERVICES=none",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        !report.warnings.iter().any(|w| w.contains("ASTROPRESS_CONTENT_SERVICES is not set")),
        "ASTROPRESS_DATA_SERVICES set must suppress the CONTENT_SERVICES missing warning; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_no_service_origin_warning_when_content_services_is_none() {
    // Kills `!= -> ==` mutation at doctor.rs:126.
    let root = temp_dir("doctor-service-origin-none");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_CONTENT_SERVICES=none",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        !report.warnings.iter().any(|w| w.contains("ASTROPRESS_SERVICE_ORIGIN")),
        "content_services=none must not warn about missing SERVICE_ORIGIN; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_no_service_origin_warning_when_origin_is_set() {
    // Kills `&& -> ||` mutation at doctor.rs:127.
    let root = temp_dir("doctor-service-origin-set");
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
        !report.warnings.iter().any(|w| w.contains("ASTROPRESS_SERVICE_ORIGIN is missing")),
        "SERVICE_ORIGIN set must not warn about missing origin; warnings: {:?}",
        report.warnings
    );
}

#[test]
fn doctor_warns_about_preview_app_host_data_services_pair() {
    // Kills `delete match arm "preview"` at doctor.rs:139.
    // github-pages + supabase → "preview" per deployment_support_level.
    // Note: "railway" is not in the JS resolver's recognised host list and defaults to
    // "github-pages", so we use the (github-pages, supabase) pair instead.
    let root = temp_dir("doctor-preview");
    fs::create_dir_all(root.join(".data")).unwrap();
    fs::write(
        root.join(".env"),
        [
            "ASTROPRESS_RUNTIME_MODE=local",
            "ASTROPRESS_LOCAL_PROVIDER=sqlite",
            "ADMIN_DB_PATH=.data/admin.sqlite",
            "ASTROPRESS_APP_HOST=github-pages",
            "ASTROPRESS_CONTENT_SERVICES=supabase",
            "ASTROPRESS_SERVICE_ORIGIN=https://proj.supabase.co/functions/v1/astropress",
            "ADMIN_BOOTSTRAP_DISABLED=1",
        ]
        .join("\n"),
    )
    .unwrap();

    let report = inspect_project_health(&root).unwrap();
    assert!(
        report.warnings.iter().any(|w| w.contains("preview")),
        "github-pages+supabase must produce a 'preview' warning; warnings: {:?}",
        report.warnings
    );
}

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
