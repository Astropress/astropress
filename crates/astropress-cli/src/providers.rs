#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PackageManager {
    Bun,
    Npm,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LocalProvider {
    Sqlite,
    Supabase,
    Runway,
}

impl LocalProvider {
    pub(crate) fn parse(value: &str) -> Result<Self, String> {
        match value {
            "sqlite" => Ok(Self::Sqlite),
            "supabase" => Ok(Self::Supabase),
            "runway" => Ok(Self::Runway),
            other => Err(format!(
                "Unsupported local provider `{other}`. Use sqlite, supabase, or runway."
            )),
        }
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Sqlite => "sqlite",
            Self::Supabase => "supabase",
            Self::Runway => "runway",
        }
    }

    pub(crate) fn default_admin_db_relative_path(self) -> &'static str {
        match self {
            Self::Sqlite => ".data/admin.sqlite",
            Self::Supabase => ".data/supabase-admin.sqlite",
            Self::Runway => ".data/runway-admin.sqlite",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AppHost {
    GithubPages,
    CloudflarePages,
    Vercel,
    Netlify,
    RenderStatic,
    RenderWeb,
    GitlabPages,
    Runway,
    Custom,
}

impl AppHost {
    pub(crate) fn parse(value: &str) -> Result<Self, String> {
        match value {
            "github-pages" => Ok(Self::GithubPages),
            "cloudflare-pages" => Ok(Self::CloudflarePages),
            "vercel" => Ok(Self::Vercel),
            "netlify" => Ok(Self::Netlify),
            "render-static" => Ok(Self::RenderStatic),
            "render-web" => Ok(Self::RenderWeb),
            "gitlab-pages" => Ok(Self::GitlabPages),
            "runway" => Ok(Self::Runway),
            "custom" => Ok(Self::Custom),
            other => Err(format!(
                "Unsupported app host `{other}`. Use github-pages, cloudflare-pages, vercel, netlify, render-static, render-web, gitlab-pages, runway, or custom."
            )),
        }
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::GithubPages => "github-pages",
            Self::CloudflarePages => "cloudflare-pages",
            Self::Vercel => "vercel",
            Self::Netlify => "netlify",
            Self::RenderStatic => "render-static",
            Self::RenderWeb => "render-web",
            Self::GitlabPages => "gitlab-pages",
            Self::Runway => "runway",
            Self::Custom => "custom",
        }
    }

    pub(crate) fn deploy_target(self) -> &'static str {
        match self {
            Self::CloudflarePages => "cloudflare",
            _ => self.as_str(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DataServices {
    None,
    Cloudflare,
    Supabase,
    Appwrite,
    Pocketbase,
    Neon,
    Nhost,
    Runway,
    Custom,
}

impl DataServices {
    pub(crate) fn parse(value: &str) -> Result<Self, String> {
        match value {
            "none" => Ok(Self::None),
            "cloudflare" => Ok(Self::Cloudflare),
            "supabase" => Ok(Self::Supabase),
            "appwrite" => Ok(Self::Appwrite),
            "pocketbase" => Ok(Self::Pocketbase),
            "neon" => Ok(Self::Neon),
            "nhost" => Ok(Self::Nhost),
            "runway" => Ok(Self::Runway),
            "custom" => Ok(Self::Custom),
            other => Err(format!(
                "Unsupported data services `{other}`. Use none, cloudflare, supabase, appwrite, pocketbase, neon, nhost, runway, or custom."
            )),
        }
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Cloudflare => "cloudflare",
            Self::Supabase => "supabase",
            Self::Appwrite => "appwrite",
            Self::Pocketbase => "pocketbase",
            Self::Neon => "neon",
            Self::Nhost => "nhost",
            Self::Runway => "runway",
            Self::Custom => "custom",
        }
    }

    pub(crate) fn default_local_provider(self) -> LocalProvider {
        match self {
            Self::Supabase => LocalProvider::Supabase,
            Self::Runway => LocalProvider::Runway,
            _ => LocalProvider::Sqlite,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AnalyticsProvider {
    None,
    Umami,
    Plausible,
    Matomo,
    PostHog,
    Custom,
}

impl AnalyticsProvider {
    pub(crate) fn parse(value: &str) -> Result<Self, String> {
        match value {
            "none" => Ok(Self::None),
            "umami" => Ok(Self::Umami),
            "plausible" => Ok(Self::Plausible),
            "matomo" => Ok(Self::Matomo),
            "posthog" => Ok(Self::PostHog),
            "custom" => Ok(Self::Custom),
            other => Err(format!(
                "Unsupported analytics provider `{other}`. Use none, umami, plausible, matomo, posthog, or custom."
            )),
        }
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Umami => "umami",
            Self::Plausible => "plausible",
            Self::Matomo => "matomo",
            Self::PostHog => "posthog",
            Self::Custom => "custom",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AbTestingProvider {
    None,
    GrowthBook,
    Unleash,
    Flagsmith,
    Custom,
}

impl AbTestingProvider {
    pub(crate) fn parse(value: &str) -> Result<Self, String> {
        match value {
            "none" => Ok(Self::None),
            "growthbook" => Ok(Self::GrowthBook),
            "unleash" => Ok(Self::Unleash),
            "flagsmith" => Ok(Self::Flagsmith),
            "custom" => Ok(Self::Custom),
            other => Err(format!(
                "Unsupported A/B testing provider `{other}`. Use none, growthbook, unleash, flagsmith, or custom."
            )),
        }
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::GrowthBook => "growthbook",
            Self::Unleash => "unleash",
            Self::Flagsmith => "flagsmith",
            Self::Custom => "custom",
        }
    }
}

/// OpenReplay (Elastic License 2.0) is excluded — not OSI-approved.
/// PostHog (MIT core) is the recommended self-hosted session replay option.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum HeatmapProvider {
    None,
    PostHog,
    Custom,
}

impl HeatmapProvider {
    pub(crate) fn parse(value: &str) -> Result<Self, String> {
        match value {
            "none" => Ok(Self::None),
            "posthog" => Ok(Self::PostHog),
            "custom" => Ok(Self::Custom),
            other => Err(format!(
                "Unsupported heatmap provider `{other}`. Use none, posthog, or custom."
            )),
        }
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::PostHog => "posthog",
            Self::Custom => "custom",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analytics_provider_round_trips() {
        let pairs = [
            ("none", AnalyticsProvider::None),
            ("umami", AnalyticsProvider::Umami),
            ("plausible", AnalyticsProvider::Plausible),
            ("matomo", AnalyticsProvider::Matomo),
            ("posthog", AnalyticsProvider::PostHog),
            ("custom", AnalyticsProvider::Custom),
        ];
        for (s, variant) in pairs {
            assert_eq!(AnalyticsProvider::parse(s).unwrap(), variant);
            assert_eq!(variant.as_str(), s);
        }
    }

    #[test]
    fn analytics_provider_rejects_unknown() {
        assert!(AnalyticsProvider::parse("mixpanel").is_err());
    }

    #[test]
    fn ab_testing_provider_round_trips() {
        let pairs = [
            ("none", AbTestingProvider::None),
            ("growthbook", AbTestingProvider::GrowthBook),
            ("unleash", AbTestingProvider::Unleash),
            ("flagsmith", AbTestingProvider::Flagsmith),
            ("custom", AbTestingProvider::Custom),
        ];
        for (s, variant) in pairs {
            assert_eq!(AbTestingProvider::parse(s).unwrap(), variant);
            assert_eq!(variant.as_str(), s);
        }
    }

    #[test]
    fn ab_testing_provider_rejects_unknown() {
        assert!(AbTestingProvider::parse("launchdarkly").is_err());
    }

    #[test]
    fn heatmap_provider_round_trips() {
        // OpenReplay removed (Elastic License 2.0, not OSI-approved).
        let pairs = [
            ("none", HeatmapProvider::None),
            ("posthog", HeatmapProvider::PostHog),
            ("custom", HeatmapProvider::Custom),
        ];
        for (s, variant) in pairs {
            assert_eq!(HeatmapProvider::parse(s).unwrap(), variant);
            assert_eq!(variant.as_str(), s);
        }
    }

    #[test]
    fn heatmap_provider_rejects_openreplay() {
        // OpenReplay was removed — parse should now error.
        assert!(HeatmapProvider::parse("openreplay").is_err());
    }

    #[test]
    fn heatmap_provider_rejects_unknown() {
        assert!(HeatmapProvider::parse("hotjar").is_err());
    }
}

pub(crate) fn deployment_support_level(app_host: &str, data_services: &str) -> &'static str {
    match (app_host, data_services) {
        ("github-pages", "none")
        | ("cloudflare-pages", "cloudflare")
        | ("vercel", "supabase")
        | ("netlify", "supabase")
        | ("render-web", "supabase")
        | ("runway", "runway") => "supported",
        ("github-pages", "supabase")
        | ("render-web", "appwrite")
        | ("gitlab-pages", "supabase")
        | ("vercel", "appwrite")
        | ("netlify", "appwrite")
        | ("cloudflare-pages", "supabase") => "preview",
        _ => "unsupported",
    }
}
