//! `astropress add` — append optional integrations to an existing project.
//!
//! Usage: `astropress add [dir] --<feature> <value> [--<feature> <value>...]`
//!
//! Appends env stubs to `.env.example` and writes any config file stubs
//! needed by the chosen integration. Safe to run multiple times (appends,
//! does not overwrite existing vars).

use std::path::Path;

use crate::feature_stubs::{feature_config_stubs, feature_env_stubs};
use crate::features::{
    AllFeatures, ChatChoice, CmsChoice, CommerceChoice, CommunityChoice, CourseChoice,
    EmailChoice, ForumChoice, NotifyChoice, PaymentChoice, ScheduleChoice, SearchChoice,
    TestimonialChoice,
};
use crate::providers::{AbTestingProvider, AnalyticsProvider, HeatmapProvider};
use crate::utils::write_text_file;

// ── env stubs for providers not covered by feature_env_stubs ─────────────────

/// Returns env stubs for analytics / A/B testing / heatmap providers.
/// These live in the JS scaffold during `new` but must be emitted
/// by the CLI directly for `add` (no JS bridge needed).
fn provider_env_stubs(
    analytics: AnalyticsProvider,
    ab_testing: AbTestingProvider,
    heatmap: HeatmapProvider,
) -> String {
    let mut lines: Vec<&str> = Vec::new();
    match analytics {
        AnalyticsProvider::Umami => lines.extend(&[
            "# Umami (privacy-first analytics — MIT; Railway / Fly.io free)",
            "PUBLIC_UMAMI_WEBSITE_ID=replace-with-your-umami-website-id",
            "PUBLIC_UMAMI_SCRIPT_URL=https://analytics.umami.is/script.js",
        ]),
        AnalyticsProvider::Plausible => lines.extend(&[
            "# Plausible (privacy-first analytics — AGPL; cloud $9/mo or self-host free)",
            "PUBLIC_PLAUSIBLE_DOMAIN=replace-with-your-domain.com",
            "PUBLIC_PLAUSIBLE_SCRIPT_URL=https://plausible.io/js/script.js",
        ]),
        AnalyticsProvider::Matomo => lines.extend(&[
            "# Matomo (full GA replacement — GPL; cloud $23/mo or self-host free)",
            "PUBLIC_MATOMO_URL=https://your-matomo-instance.example.com",
            "PUBLIC_MATOMO_SITE_ID=1",
        ]),
        AnalyticsProvider::PostHog => lines.extend(&[
            "# PostHog (analytics + feature flags + session replay — MIT; generous free tier)",
            "PUBLIC_POSTHOG_KEY=replace-with-your-posthog-api-key",
            "PUBLIC_POSTHOG_HOST=https://app.posthog.com",
        ]),
        AnalyticsProvider::Custom => lines.push("# Analytics: configure manually"),
        AnalyticsProvider::None => {}
    }
    match ab_testing {
        AbTestingProvider::GrowthBook => lines.extend(&[
            "# GrowthBook (feature flags + A/B testing — MIT; generous free cloud tier)",
            "GROWTHBOOK_API_HOST=https://cdn.growthbook.io",
            "GROWTHBOOK_CLIENT_KEY=replace-with-your-growthbook-client-key",
        ]),
        AbTestingProvider::Unleash => lines.extend(&[
            "# Unleash (enterprise feature toggles — Apache 2.0; self-host free)",
            "UNLEASH_URL=https://your-unleash-instance.example.com/api",
            "UNLEASH_CLIENT_KEY=replace-with-your-unleash-client-key",
        ]),
        AbTestingProvider::Custom => lines.push("# A/B testing: configure manually"),
        AbTestingProvider::None => {}
    }
    match heatmap {
        HeatmapProvider::PostHog => {
            // Only emit PostHog vars here if analytics wasn't already PostHog
            if analytics != AnalyticsProvider::PostHog {
                lines.extend(&[
                    "# PostHog (session replay + heatmaps — MIT; generous free tier)",
                    "PUBLIC_POSTHOG_KEY=replace-with-your-posthog-api-key",
                    "PUBLIC_POSTHOG_HOST=https://app.posthog.com",
                ]);
            }
        }
        HeatmapProvider::Custom => lines.push("# Session replay / heatmaps: configure manually"),
        HeatmapProvider::None => {}
    }
    if lines.is_empty() {
        String::new()
    } else {
        format!("\n# Optional integrations\n{}\n", lines.join("\n"))
    }
}

// ── main entry point ──────────────────────────────────────────────────────────

/// Apply one or more integration additions to an existing project directory.
pub(crate) fn add_integrations(project_dir: &Path, features: AllFeatures) -> Result<(), String> {
    if !project_dir.exists() {
        return Err(format!(
            "Project directory `{}` does not exist. Run `astropress new` first.",
            project_dir.display()
        ));
    }

    let feature_stubs = feature_env_stubs(&features);
    let provider_stubs = provider_env_stubs(features.analytics, features.ab_testing, features.heatmap);
    let all_env_stubs = format!("{feature_stubs}{provider_stubs}");
    let config_stubs = feature_config_stubs(&features);

    if all_env_stubs.trim().is_empty() && config_stubs.is_empty() {
        println!("Nothing to add — no recognised integration flags were provided.");
        return Ok(());
    }

    // Append env stubs to .env.example
    if !all_env_stubs.trim().is_empty() {
        let env_example_path = project_dir.join(".env.example");
        let existing = if env_example_path.exists() {
            std::fs::read_to_string(&env_example_path)
                .map_err(|e| format!("Could not read .env.example: {e}"))?
        } else {
            String::new()
        };
        let trimmed = existing.trim_end_matches('\n');
        let updated = format!("{trimmed}{all_env_stubs}");
        std::fs::write(&env_example_path, updated)
            .map_err(|e| format!("Could not write .env.example: {e}"))?;
        println!("Updated .env.example with new environment variables.");
    }

    // Write config file stubs
    for (rel_path, content) in &config_stubs {
        write_text_file(project_dir, rel_path, content)?;
        println!("Wrote {rel_path}");
    }

    Ok(())
}

// ── argument parsing ──────────────────────────────────────────────────────────

/// Parse `--feature value` pairs from add command args.
/// Starts from a blank `AllFeatures` (everything None/default-false) so that
/// only the flags actually passed produce output.
pub(crate) fn parse_add_features(args: &[String]) -> Result<AllFeatures, String> {
    let mut f = AllFeatures::defaults();
    // Reset community to None so we don't accidentally include Giscus env stubs
    // when the user hasn't asked for comments.
    f.community = CommunityChoice::None;

    let mut index = 0;
    while index < args.len() {
        let flag = &args[index];
        let value = args
            .get(index + 1)
            .ok_or_else(|| format!("Missing value after `{flag}`."))?;

        match flag.as_str() {
            "--analytics" => {
                f.analytics = AnalyticsProvider::parse(value).map_err(|_| {
                    format!(
                        "Unknown analytics provider `{value}`. Use: umami, plausible, matomo, posthog, custom."
                    )
                })?;
            }
            "--email" => {
                f.email = match value.as_str() {
                    "listmonk" => EmailChoice::Listmonk,
                    other => return Err(format!(
                        "Unknown email provider `{other}`. Use: listmonk."
                    )),
                };
            }
            "--commerce" => {
                f.commerce = match value.as_str() {
                    "medusa"   => CommerceChoice::Medusa,
                    "vendure"  => CommerceChoice::Vendure,
                    other => return Err(format!(
                        "Unknown commerce platform `{other}`. Use: medusa, vendure."
                    )),
                };
            }
            "--community" | "--comments" => {
                f.community = match value.as_str() {
                    "giscus"   => CommunityChoice::Giscus,
                    "remark42" => CommunityChoice::Remark42,
                    other => return Err(format!(
                        "Unknown comments provider `{other}`. Use: giscus, remark42."
                    )),
                };
            }
            "--search" => {
                f.search = match value.as_str() {
                    "pagefind"    => SearchChoice::Pagefind,
                    "meilisearch" => SearchChoice::Meilisearch,
                    other => return Err(format!(
                        "Unknown search provider `{other}`. Use: pagefind, meilisearch."
                    )),
                };
            }
            "--courses" => {
                f.courses = match value.as_str() {
                    "frappe-lms" | "frapplms" => CourseChoice::FrappeLms,
                    other => return Err(format!(
                        "Unknown LMS `{other}`. Use: frappe-lms."
                    )),
                };
            }
            "--testimonials" => {
                f.testimonials = match value.as_str() {
                    "formbricks" => TestimonialChoice::Formbricks,
                    other => return Err(format!(
                        "Unknown testimonials provider `{other}`. Use: formbricks."
                    )),
                };
            }
            "--forum" => {
                f.forum = match value.as_str() {
                    "flarum"    => ForumChoice::Flarum,
                    "discourse" => ForumChoice::Discourse,
                    other => return Err(format!(
                        "Unknown forum software `{other}`. Use: flarum, discourse."
                    )),
                };
            }
            "--chat" => {
                f.chat = match value.as_str() {
                    "tiledesk" => ChatChoice::Tiledesk,
                    other => return Err(format!(
                        "Unknown chat provider `{other}`. Use: tiledesk."
                    )),
                };
            }
            "--payments" => {
                f.payments = match value.as_str() {
                    "hyperswitch" => PaymentChoice::HyperSwitch,
                    other => return Err(format!(
                        "Unknown payment router `{other}`. Use: hyperswitch."
                    )),
                };
            }
            "--notify" | "--notifications" => {
                f.notify = match value.as_str() {
                    "ntfy"   => NotifyChoice::Ntfy,
                    "gotify" => NotifyChoice::Gotify,
                    other => return Err(format!(
                        "Unknown notifications provider `{other}`. Use: ntfy, gotify."
                    )),
                };
            }
            "--schedule" => {
                f.schedule = match value.as_str() {
                    "rallly"           => ScheduleChoice::Rallly,
                    "calcom" | "cal.com" => ScheduleChoice::CalCom,
                    other => return Err(format!(
                        "Unknown scheduling provider `{other}`. Use: rallly, calcom."
                    )),
                };
            }
            "--cms" => {
                f.cms = match value.as_str() {
                    "keystatic" => CmsChoice::Keystatic,
                    "payload"   => CmsChoice::Payload,
                    other => return Err(format!(
                        "Unknown CMS `{other}`. Use: keystatic, payload."
                    )),
                };
            }
            "--heatmap" | "--session-replay" => {
                f.heatmap = HeatmapProvider::parse(value).map_err(|_| {
                    format!("Unknown heatmap provider `{value}`. Use: posthog, custom.")
                })?;
            }
            "--ab-testing" | "--ab_testing" => {
                f.ab_testing = AbTestingProvider::parse(value).map_err(|_| {
                    format!(
                        "Unknown A/B testing provider `{value}`. Use: growthbook, unleash, custom."
                    )
                })?;
            }
            "--polar" => {
                f.donations.polar = matches!(value.as_str(), "true" | "1" | "yes");
            }
            "--give-lively" => {
                f.donations.give_lively = matches!(value.as_str(), "true" | "1" | "yes");
            }
            "--liberapay" => {
                f.donations.liberapay = matches!(value.as_str(), "true" | "1" | "yes");
            }
            "--pledge-crypto" => {
                f.donations.pledge_crypto = matches!(value.as_str(), "true" | "1" | "yes");
            }
            other => {
                return Err(format!(
                    "Unknown flag `{other}`. Run `astropress add --help` for available options."
                ))
            }
        }
        index += 2;
    }

    Ok(f)
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn args(s: &[&str]) -> Vec<String> {
        s.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn add_analytics_umami_parses() {
        let f = parse_add_features(&args(&["--analytics", "umami"])).unwrap();
        assert_eq!(f.analytics, AnalyticsProvider::Umami);
    }

    #[test]
    fn add_email_listmonk_parses() {
        let f = parse_add_features(&args(&["--email", "listmonk"])).unwrap();
        assert_eq!(f.email, EmailChoice::Listmonk);
    }

    #[test]
    fn add_forum_flarum_parses() {
        let f = parse_add_features(&args(&["--forum", "flarum"])).unwrap();
        assert_eq!(f.forum, ForumChoice::Flarum);
    }

    #[test]
    fn add_notify_gotify_parses() {
        let f = parse_add_features(&args(&["--notify", "gotify"])).unwrap();
        assert_eq!(f.notify, NotifyChoice::Gotify);
    }

    #[test]
    fn add_schedule_calcom_parses() {
        let f = parse_add_features(&args(&["--schedule", "calcom"])).unwrap();
        assert_eq!(f.schedule, ScheduleChoice::CalCom);
    }

    #[test]
    fn add_commerce_vendure_parses() {
        let f = parse_add_features(&args(&["--commerce", "vendure"])).unwrap();
        assert_eq!(f.commerce, CommerceChoice::Vendure);
    }

    #[test]
    fn add_chat_tiledesk_parses() {
        let f = parse_add_features(&args(&["--chat", "tiledesk"])).unwrap();
        assert_eq!(f.chat, ChatChoice::Tiledesk);
    }

    #[test]
    fn add_unknown_flag_returns_error() {
        let result = parse_add_features(&args(&["--unknown-flag", "value"]));
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("Unknown flag"),
            "expected 'Unknown flag' in error, got: {err}"
        );
    }

    #[test]
    fn add_analytics_umami_appends_env_stubs() {
        let f = parse_add_features(&args(&["--analytics", "umami"])).unwrap();
        let stubs = provider_env_stubs(f.analytics, f.ab_testing, f.heatmap);
        assert!(
            stubs.contains("PUBLIC_UMAMI_SCRIPT_URL"),
            "expected PUBLIC_UMAMI_SCRIPT_URL in stubs, got: {stubs}"
        );
    }

    #[test]
    fn add_email_listmonk_generates_config_files() {
        let f = parse_add_features(&args(&["--email", "listmonk"])).unwrap();
        let config_stubs = feature_config_stubs(&f);
        let paths: Vec<_> = config_stubs.iter().map(|(p, _)| *p).collect();
        assert!(
            paths.iter().any(|p| p.contains("listmonk")),
            "expected listmonk config files, got: {paths:?}"
        );
    }

    #[test]
    fn add_forum_flarum_appends_env_stubs() {
        let f = parse_add_features(&args(&["--forum", "flarum"])).unwrap();
        let stubs = feature_env_stubs(&f);
        assert!(stubs.contains("FLARUM_URL"), "expected FLARUM_URL in stubs, got: {stubs}");
        assert!(stubs.contains("FLARUM_API_KEY"), "expected FLARUM_API_KEY in stubs, got: {stubs}");
    }

    #[test]
    fn add_notify_gotify_appends_env_stubs() {
        let f = parse_add_features(&args(&["--notify", "gotify"])).unwrap();
        let stubs = feature_env_stubs(&f);
        assert!(stubs.contains("GOTIFY_URL"), "expected GOTIFY_URL in stubs, got: {stubs}");
        assert!(stubs.contains("GOTIFY_APP_TOKEN"), "expected GOTIFY_APP_TOKEN in stubs, got: {stubs}");
    }

    #[test]
    fn add_schedule_calcom_appends_env_stubs() {
        let f = parse_add_features(&args(&["--schedule", "calcom"])).unwrap();
        let stubs = feature_env_stubs(&f);
        assert!(stubs.contains("CALCOM_API_URL"), "expected CALCOM_API_URL in stubs, got: {stubs}");
        assert!(stubs.contains("CALCOM_API_KEY"), "expected CALCOM_API_KEY in stubs, got: {stubs}");
    }

    #[test]
    fn add_commerce_vendure_appends_env_stubs() {
        let f = parse_add_features(&args(&["--commerce", "vendure"])).unwrap();
        let stubs = feature_env_stubs(&f);
        assert!(stubs.contains("VENDURE_API_URL"), "expected VENDURE_API_URL in stubs, got: {stubs}");
        assert!(stubs.contains("VENDURE_ADMIN_API_URL"), "expected VENDURE_ADMIN_API_URL in stubs, got: {stubs}");
    }

    #[test]
    fn add_chat_tiledesk_appends_env_stubs() {
        let f = parse_add_features(&args(&["--chat", "tiledesk"])).unwrap();
        let stubs = feature_env_stubs(&f);
        assert!(stubs.contains("TILEDESK_API_URL"), "expected TILEDESK_API_URL in stubs, got: {stubs}");
        assert!(stubs.contains("TILEDESK_PROJECT_ID"), "expected TILEDESK_PROJECT_ID in stubs, got: {stubs}");
        assert!(stubs.contains("TILEDESK_TOKEN"), "expected TILEDESK_TOKEN in stubs, got: {stubs}");
    }

    #[test]
    fn add_to_nonexistent_dir_returns_error() {
        let f = AllFeatures::defaults();
        let result = add_integrations(Path::new("/nonexistent/dir/that/does/not/exist"), f);
        match result {
            Err(err) => assert!(
                err.contains("does not exist"),
                "expected 'does not exist' in error, got: {err}"
            ),
            Ok(()) => panic!("expected an error but got Ok"),
        }
    }
}
