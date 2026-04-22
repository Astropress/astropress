//! CLI argument-parsing tests. Extracted from `mod.rs` to keep that file
//! under the 600-line arch-lint cap.

use super::*;
use commands::add::parse_add_features;

#[test]
fn parses_import_wordpress_field_values() {
    let cmd = parse_command(&strings(&[
        "import", "wordpress",
        "--source", "export.xml",
        "--project-dir", "/wp",
        "--artifact-dir", "/art",
        "--username", "admin",
        "--password", "secret",
        "--credentials-file", "/creds.json",
    ])).unwrap();
    if let Command::ImportWordPress { project_dir, source_path, artifact_dir, username, password, credentials_file, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/wp"));
        assert_eq!(source_path, Some(std::path::PathBuf::from("export.xml")));
        assert_eq!(artifact_dir, Some(std::path::PathBuf::from("/art")));
        assert_eq!(username, Some("admin".to_string()));
        assert_eq!(password, Some("secret".to_string()));
        assert_eq!(credentials_file, Some(std::path::PathBuf::from("/creds.json")));
    } else {
        panic!("Expected ImportWordPress command");
    }
}

#[test]
fn parses_import_wordpress_url_field_values() {
    let cmd = parse_command(&strings(&[
        "import", "wordpress",
        "--url", "https://mysite.com",
        "--project-dir", "/wp2",
        "--artifact-dir", "/art2",
    ])).unwrap();
    if let Command::ImportWordPress { project_dir, url, artifact_dir, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/wp2"));
        assert_eq!(url, Some("https://mysite.com".to_string()));
        assert_eq!(artifact_dir, Some(std::path::PathBuf::from("/art2")));
    } else {
        panic!("Expected ImportWordPress command");
    }
}

#[test]
fn parses_import_wix_field_values() {
    let cmd = parse_command(&strings(&[
        "import", "wix",
        "--source", "export.csv",
        "--project-dir", "/wix",
        "--artifact-dir", "/wixart",
        "--email", "user@example.com",
        "--password", "pass123",
        "--credentials-file", "/wix-creds.json",
    ])).unwrap();
    if let Command::ImportWix { project_dir, source_path, artifact_dir, email, password, credentials_file, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/wix"));
        assert_eq!(source_path, Some(std::path::PathBuf::from("export.csv")));
        assert_eq!(artifact_dir, Some(std::path::PathBuf::from("/wixart")));
        assert_eq!(email, Some("user@example.com".to_string()));
        assert_eq!(password, Some("pass123".to_string()));
        assert_eq!(credentials_file, Some(std::path::PathBuf::from("/wix-creds.json")));
    } else {
        panic!("Expected ImportWix command");
    }
}

#[test]
fn parses_deploy_field_values() {
    let cmd = parse_command(&strings(&["deploy", "--project-dir", "/dep", "--target", "cloudflare"])).unwrap();
    if let Command::Deploy { project_dir, target, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/dep"));
        assert_eq!(target, Some("cloudflare".to_string()));
    } else {
        panic!("Expected Deploy command");
    }
}

#[test]
fn parses_migrate_field_values() {
    let cmd = parse_command(&strings(&["migrate", "--from", "rallly", "--to", "calcom"])).unwrap();
    if let Command::Migrate { from, to, dry_run, .. } = cmd {
        assert_eq!(from, "rallly");
        assert_eq!(to, "calcom");
        assert!(!dry_run);
    } else {
        panic!("Expected Migrate command");
    }
}

#[test]
fn parses_new_command_positional_project_dir() {
    let cmd = parse_command(&strings(&["new", "my-site"])).unwrap();
    if let Command::New { project_dir, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("my-site"));
    } else {
        panic!("Expected New command");
    }
}

#[test]
fn parses_dev_command_positional_project_dir() {
    let cmd = parse_command(&strings(&["dev", "/my/proj"])).unwrap();
    if let Command::Dev { project_dir, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/my/proj"));
    } else {
        panic!("Expected Dev command");
    }
}

#[test]
fn parses_add_command_positional_project_dir() {
    let cmd = parse_command(&strings(&["add", "/my/proj", "--analytics", "umami"])).unwrap();
    if let Command::Add { project_dir, feature_args } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/my/proj"));
        assert_eq!(feature_args, vec!["--analytics".to_string(), "umami".to_string()]);
    } else {
        panic!("Expected Add command");
    }
}

#[test]
fn parses_list_tools_command() {
    let cmd = parse_command(&strings(&["list", "tools"])).unwrap();
    assert_eq!(cmd, Command::ListTools);
}

#[test]
fn parses_ls_tools_alias() {
    let cmd = parse_command(&strings(&["ls", "tools"])).unwrap();
    assert_eq!(cmd, Command::ListTools);
}

#[test]
fn parses_list_providers_command() {
    let cmd = parse_command(&strings(&["list", "providers"])).unwrap();
    assert_eq!(cmd, Command::ListProviders);
}

#[test]
fn parses_ls_providers_alias() {
    let cmd = parse_command(&strings(&["ls", "providers"])).unwrap();
    assert_eq!(cmd, Command::ListProviders);
}

#[test]
fn parses_telemetry_status() {
    let cmd = parse_command(&strings(&["telemetry", "status"])).unwrap();
    assert!(matches!(cmd, Command::Telemetry { action: telemetry::TelemetryAction::Status }));
}

#[test]
fn parse_add_features_analytics_umami() {
    let args = strings(&["--analytics", "umami"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.analytics, providers::AnalyticsProvider::Umami);
}

#[test]
fn parse_add_features_analytics_plausible() {
    let args = strings(&["--analytics", "plausible"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.analytics, providers::AnalyticsProvider::Plausible);
}

#[test]
fn parse_add_features_email_listmonk() {
    use features::EmailChoice;
    let args = strings(&["--email", "listmonk"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.email, EmailChoice::Listmonk);
}
