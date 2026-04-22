use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::providers::{AppHost, DataServices, LocalProvider};

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct PackageManifest {
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) private: bool,
    #[serde(rename = "type", default)]
    pub(crate) package_type: Option<String>,
    #[serde(default)]
    pub(crate) scripts: BTreeMap<String, String>,
    #[serde(default)]
    pub(crate) dependencies: BTreeMap<String, String>,
    #[serde(rename = "devDependencies", default)]
    pub(crate) dev_dependencies: BTreeMap<String, String>,
}

pub(crate) fn read_package_manifest(project_dir: &Path) -> Result<PackageManifest, String> { // ~ skip
    let package_json =
        fs::read_to_string(project_dir.join("package.json")).map_err(crate::io_error)?;
    serde_json::from_str::<PackageManifest>(&package_json).map_err(|error| error.to_string())
}

pub(crate) fn write_package_manifest(
    project_dir: &Path,
    manifest: &PackageManifest,
) -> Result<(), String> { // ~ skip
    let package_json =
        serde_json::to_string_pretty(manifest).map_err(|error| error.to_string())?;
    fs::write(project_dir.join("package.json"), format!("{package_json}\n"))
        .map_err(crate::io_error)
}

pub(crate) fn format_env_map(values: &BTreeMap<String, String>) -> String {
    let mut output = String::new();
    for (key, value) in values {
        output.push_str(key);
        output.push('=');
        output.push_str(value);
        output.push('\n');
    }
    output
}

pub(crate) fn read_env_path(env_path: &Path) -> Result<BTreeMap<String, String>, String> { // ~ skip
    if !env_path.exists() {
        return Ok(BTreeMap::new());
    }

    let contents = fs::read_to_string(env_path).map_err(crate::io_error)?;
    let mut values = BTreeMap::new();
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') { // ~ skip
            continue;
        }

        if let Some((key, value)) = trimmed.split_once('=') {
            values.insert(key.trim().to_string(), value.trim().to_string());
        }
    }

    Ok(values)
}

pub(crate) fn read_env_file(project_dir: &Path) -> Result<BTreeMap<String, String>, String> {
    read_env_path(&project_dir.join(".env"))
}

pub(crate) fn migrate_env_map(
    mut env_values: BTreeMap<String, String>,
) -> BTreeMap<String, String> {
    if !env_values.contains_key("ASTROPRESS_CONTENT_SERVICES") {
        if let Some(value) = env_values.get("ASTROPRESS_DATA_SERVICES").cloned() {
            env_values.insert("ASTROPRESS_CONTENT_SERVICES".into(), value);
        } else if let Some(value) = env_values.get("ASTROPRESS_BACKEND_PLATFORM").cloned() {
            env_values.insert("ASTROPRESS_CONTENT_SERVICES".into(), value);
        }
    }

    if !env_values.contains_key("ASTROPRESS_APP_HOST") {
        if let Some(value) = env_values.get("ASTROPRESS_DEPLOY_TARGET").cloned() {
            let app_host = match value.as_str() {
                "cloudflare" => "cloudflare-pages",
                "github-pages" | "vercel" | "netlify" | "render-static" | "render-web"
                | "gitlab-pages" | "custom" => value.as_str(),
                _ => "",
            };
            if !app_host.is_empty() {
                env_values.insert("ASTROPRESS_APP_HOST".into(), app_host.to_string());
            }
        }
    }

    if !env_values.contains_key("ASTROPRESS_SERVICE_ORIGIN") {
        if let Some(url) = env_values.get("SUPABASE_URL").cloned() {
            env_values.insert(
                "ASTROPRESS_SERVICE_ORIGIN".into(),
                format!("{}/functions/v1/astropress", url.trim_end_matches('/')),
            );
        } else if let Some(endpoint) = env_values.get("APPWRITE_ENDPOINT").cloned() {
            env_values.insert(
                "ASTROPRESS_SERVICE_ORIGIN".into(),
                format!("{}/functions/astropress", endpoint.trim_end_matches('/')),
            );
        }
    }

    env_values.remove("ASTROPRESS_DATA_SERVICES");
    env_values.remove("ASTROPRESS_BACKEND_PLATFORM");
    env_values.remove("ASTROPRESS_HOSTED_PROVIDER");
    env_values.remove("ASTROPRESS_DEPLOY_TARGET");

    env_values
}

pub(crate) fn migrate_package_manifest_scripts(manifest: &mut PackageManifest) -> bool {
    let mut changed = false;
    for command in manifest.scripts.values_mut() {
        let updated = command
            .replace("--data-services", "--content-services")
            .replace("ASTROPRESS_DATA_SERVICES", "ASTROPRESS_CONTENT_SERVICES");
        if *command != updated {
            *command = updated;
            changed = true;
        }
    }
    changed
}

#[cfg(test)]
mod tests {
    use super::*;

    fn btree(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn read_env_path_ignores_comment_lines_containing_equals() {
        let tmp = std::env::temp_dir().join("ap_env_comment_test.env");
        std::fs::write(&tmp, "# DISABLED=true\nACTUAL=value\n# another=comment\n").unwrap();
        let result = read_env_path(&tmp).unwrap();
        // With || → && mutation, "# DISABLED" would be inserted as a key
        assert!(!result.keys().any(|k| k.starts_with('#')),
            "comment lines with '=' must not be parsed as keys: {result:?}");
        assert_eq!(result.get("ACTUAL"), Some(&"value".to_string()));
        std::fs::remove_file(&tmp).ok();
    }

    #[test]
    fn migrate_env_map_converts_deploy_target_github_pages() {
        let env = btree(&[("ASTROPRESS_DEPLOY_TARGET", "github-pages")]);
        let out = migrate_env_map(env);
        assert_eq!(out.get("ASTROPRESS_APP_HOST"), Some(&"github-pages".to_string()));
    }

    #[test]
    fn migrate_env_map_converts_deploy_target_vercel() {
        let env = btree(&[("ASTROPRESS_DEPLOY_TARGET", "vercel")]);
        let out = migrate_env_map(env);
        assert_eq!(out.get("ASTROPRESS_APP_HOST"), Some(&"vercel".to_string()));
    }

    #[test]
    fn migrate_env_map_converts_deploy_target_netlify() {
        let env = btree(&[("ASTROPRESS_DEPLOY_TARGET", "netlify")]);
        let out = migrate_env_map(env);
        assert_eq!(out.get("ASTROPRESS_APP_HOST"), Some(&"netlify".to_string()));
    }

    #[test]
    fn migrate_env_map_converts_deploy_target_custom() {
        let env = btree(&[("ASTROPRESS_DEPLOY_TARGET", "custom")]);
        let out = migrate_env_map(env);
        assert_eq!(out.get("ASTROPRESS_APP_HOST"), Some(&"custom".to_string()));
    }

    #[test]
    fn migrate_env_map_converts_deploy_target_cloudflare() {
        let env = btree(&[("ASTROPRESS_DEPLOY_TARGET", "cloudflare")]);
        let out = migrate_env_map(env);
        assert_eq!(out.get("ASTROPRESS_APP_HOST"), Some(&"cloudflare-pages".to_string()));
    }

    #[test]
    fn migrate_env_map_ignores_unknown_deploy_target() {
        let env = btree(&[("ASTROPRESS_DEPLOY_TARGET", "fly-io-unknown")]);
        let out = migrate_env_map(env);
        assert_eq!(out.get("ASTROPRESS_APP_HOST"), None);
    }

    #[test]
    fn migrate_package_manifest_scripts_replaces_data_services() {
        let mut manifest = PackageManifest {
            name: "test".into(),
            private: false,
            package_type: None,
            scripts: [("dev".to_string(), "astropress dev --data-services supabase".to_string())].into(),
            dependencies: BTreeMap::new(),
            dev_dependencies: BTreeMap::new(),
        };
        let changed = migrate_package_manifest_scripts(&mut manifest);
        assert!(changed);
        assert_eq!(manifest.scripts["dev"], "astropress dev --content-services supabase");
    }

    #[test]
    fn migrate_package_manifest_scripts_no_change_when_already_updated() {
        let mut manifest = PackageManifest {
            name: "test".into(),
            private: false,
            package_type: None,
            scripts: [("dev".to_string(), "astropress dev --content-services supabase".to_string())].into(),
            dependencies: BTreeMap::new(),
            dev_dependencies: BTreeMap::new(),
        };
        let changed = migrate_package_manifest_scripts(&mut manifest);
        assert!(!changed);
    }
}

pub(crate) fn merge_env_overrides(
    mut env_values: BTreeMap<String, String>,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
    provider: Option<LocalProvider>,
) -> BTreeMap<String, String> {
    if let Some(app_host) = app_host {
        env_values.insert("ASTROPRESS_APP_HOST".into(), app_host.as_str().into());
        env_values.insert(
            "ASTROPRESS_DEPLOY_TARGET".into(),
            app_host.deploy_target().into(),
        );
    }
    if let Some(data_services) = data_services {
        env_values.insert(
            "ASTROPRESS_CONTENT_SERVICES".into(),
            data_services.as_str().into(),
        );
        env_values.insert(
            "ASTROPRESS_DATA_SERVICES".into(),
            data_services.as_str().into(),
        );
    }
    if let Some(provider) = provider {
        env_values.insert("ASTROPRESS_LOCAL_PROVIDER".into(), provider.as_str().into());
    }
    env_values
}
