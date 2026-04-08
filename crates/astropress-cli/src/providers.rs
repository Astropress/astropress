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
    FirebaseHosting,
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
            "firebase-hosting" => Ok(Self::FirebaseHosting),
            "runway" => Ok(Self::Runway),
            "custom" => Ok(Self::Custom),
            other => Err(format!(
                "Unsupported app host `{other}`. Use github-pages, cloudflare-pages, vercel, netlify, render-static, render-web, gitlab-pages, firebase-hosting, runway, or custom."
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
            Self::FirebaseHosting => "firebase-hosting",
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
    Firebase,
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
            "firebase" => Ok(Self::Firebase),
            "appwrite" => Ok(Self::Appwrite),
            "pocketbase" => Ok(Self::Pocketbase),
            "neon" => Ok(Self::Neon),
            "nhost" => Ok(Self::Nhost),
            "runway" => Ok(Self::Runway),
            "custom" => Ok(Self::Custom),
            other => Err(format!(
                "Unsupported data services `{other}`. Use none, cloudflare, supabase, firebase, appwrite, pocketbase, neon, nhost, runway, or custom."
            )),
        }
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Cloudflare => "cloudflare",
            Self::Supabase => "supabase",
            Self::Firebase => "firebase",
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

pub(crate) fn deployment_support_level(app_host: &str, data_services: &str) -> &'static str {
    match (app_host, data_services) {
        ("github-pages", "none")
        | ("cloudflare-pages", "cloudflare")
        | ("vercel", "supabase")
        | ("netlify", "supabase")
        | ("render-web", "supabase")
        | ("runway", "runway") => "supported",
        ("github-pages", "supabase")
        | ("github-pages", "firebase")
        | ("render-web", "firebase")
        | ("render-web", "appwrite")
        | ("gitlab-pages", "supabase")
        | ("firebase-hosting", "supabase")
        | ("vercel", "firebase")
        | ("netlify", "firebase")
        | ("vercel", "appwrite")
        | ("netlify", "appwrite")
        | ("cloudflare-pages", "supabase")
        | ("cloudflare-pages", "firebase") => "preview",
        _ => "unsupported",
    }
}
