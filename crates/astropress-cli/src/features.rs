//! Optional integration choices for `astropress new`.
//! Each feature has an enum, env stubs, optional config file stubs, and a summary label.

use crate::providers::{AbTestingProvider, AnalyticsProvider, AppHost, HeatmapProvider};

// ── one enum per optional feature ────────────────────────────────────────────

/// Content backend for the project. AstroPress is always the admin panel;
/// this selects what stores and serves the content data.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CmsChoice { BuiltIn, Keystatic, Directus, Payload }

#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum EmailChoice      { None, Listmonk }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CommerceChoice   { None, Medusa }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CommunityChoice  { None, Giscus, Remark42 }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum SearchChoice     { None, Pagefind }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CourseChoice     { None, FrappeLms }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum TestimonialChoice{ None, Formbricks }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum DonationChoice   { None, Polar }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ForumChoice      { None, Flarum }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ChatChoice       { None, Chatwoot }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum PaymentChoice    { None, HyperSwitch }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum NotifyChoice     { None, Ntfy }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ScheduleChoice   { None, Rallly }

// ── aggregated feature bag ────────────────────────────────────────────────────

pub(crate) struct AllFeatures {
    pub cms:          CmsChoice,
    pub email:        EmailChoice,
    pub commerce:     CommerceChoice,
    pub community:    CommunityChoice,
    pub search:       SearchChoice,
    pub courses:      CourseChoice,
    pub testimonials: TestimonialChoice,
    pub donations:    DonationChoice,
    pub forum:        ForumChoice,
    pub chat:         ChatChoice,
    pub payments:     PaymentChoice,
    pub notify:       NotifyChoice,
    pub schedule:     ScheduleChoice,
    pub job_board:    bool,
    pub analytics:    AnalyticsProvider,
    pub ab_testing:   AbTestingProvider,
    pub heatmap:      HeatmapProvider,
    pub enable_api:   bool,
}

impl AllFeatures {
    pub(crate) fn defaults() -> Self {
        AllFeatures {
            cms:          CmsChoice::BuiltIn,
            email:        EmailChoice::None,
            commerce:     CommerceChoice::None,
            community:    CommunityChoice::Giscus,
            search:       SearchChoice::None,
            courses:      CourseChoice::None,
            testimonials: TestimonialChoice::None,
            donations:    DonationChoice::None,
            forum:        ForumChoice::None,
            chat:         ChatChoice::None,
            payments:     PaymentChoice::None,
            notify:       NotifyChoice::None,
            schedule:     ScheduleChoice::None,
            job_board:    false,
            analytics:    AnalyticsProvider::None,
            ab_testing:   AbTestingProvider::None,
            heatmap:      HeatmapProvider::None,
            enable_api:   false,
        }
    }
}

// ── env stubs ─────────────────────────────────────────────────────────────────

pub(crate) fn feature_env_stubs(f: &AllFeatures) -> String {
    let mut lines: Vec<&str> = Vec::new();

    match f.cms {
        CmsChoice::Keystatic => lines.push("# Keystatic CMS — configure in keystatic.config.ts"),
        CmsChoice::Directus  => lines.extend(&["# Directus CMS",
            "DIRECTUS_URL=http://localhost:8055", "DIRECTUS_TOKEN=replace-me"]),
        CmsChoice::Payload   => lines.extend(&["# Payload CMS",
            "PAYLOAD_URL=http://localhost:3000", "PAYLOAD_SECRET=replace-me"]),
        CmsChoice::BuiltIn   => {}
    }

    if f.email == EmailChoice::Listmonk {
        lines.extend(&["# Listmonk (email / newsletter)",
            "LISTMONK_URL=http://localhost:9001", "LISTMONK_USERNAME=listmonk",
            "LISTMONK_PASSWORD=replace-me", "LISTMONK_API_URL=http://localhost:9001",
            "LISTMONK_API_TOKEN=replace-me"]);
    }
    if f.commerce == CommerceChoice::Medusa {
        lines.extend(&["# Medusa (e-commerce)", "MEDUSA_BACKEND_URL=http://localhost:9000"]);
    }
    if f.community == CommunityChoice::Remark42 {
        lines.extend(&["# Remark42 (comments)",
            "REMARK42_URL=http://localhost:8080", "REMARK42_SITE_ID=remark"]);
    }
    if f.search == SearchChoice::Pagefind {
        lines.push("# Pagefind — add `npx pagefind --source dist` to your build script");
    }
    if f.courses == CourseChoice::FrappeLms {
        lines.extend(&["# Frappe LMS (courses)",
            "FRAPPE_LMS_URL=http://localhost:8000", "FRAPPE_LMS_API_KEY=replace-me"]);
    }
    if f.testimonials == TestimonialChoice::Formbricks {
        lines.extend(&["# Formbricks (testimonials + surveys)",
            "FORMBRICKS_URL=http://localhost:3000", "FORMBRICKS_API_KEY=replace-me",
            "FORMBRICKS_ENVIRONMENT_ID=replace-me"]);
    }
    if f.donations == DonationChoice::Polar {
        lines.extend(&["# Polar (donations / sponsorships)",
            "POLAR_ACCESS_TOKEN=replace-me", "POLAR_ORGANIZATION_ID=replace-me"]);
    }
    if f.forum == ForumChoice::Flarum {
        lines.extend(&["# Flarum (forum)",
            "FLARUM_URL=http://localhost:8080", "FLARUM_API_KEY=replace-me"]);
    }
    if f.chat == ChatChoice::Chatwoot {
        lines.extend(&["# Chatwoot (live chat + support)",
            "CHATWOOT_URL=http://localhost:3000",
            "CHATWOOT_API_ACCESS_TOKEN=replace-me", "CHATWOOT_INBOX_ID=replace-me"]);
    }
    if f.payments == PaymentChoice::HyperSwitch {
        lines.extend(&["# HyperSwitch (payment router — Apache 2.0)",
            "# Routes to: Stripe (M-PESA/cards/Apple Pay), Razorpay (UPI/India),",
            "# PayPal (Venmo), Square (Cash App), and 50+ more providers.",
            "# Add connector API keys via the HyperSwitch dashboard after deploying.",
            "HYPERSWITCH_API_KEY=replace-me",
            "HYPERSWITCH_BASE_URL=http://localhost:8080",
            "PAYMENT_SUCCESS_REDIRECT_URL=https://yourdomain.com/payment/success",
            "PAYMENT_FAILURE_REDIRECT_URL=https://yourdomain.com/payment/failure"]);
    }
    if f.notify == NotifyChoice::Ntfy {
        lines.extend(&["# ntfy (push notifications — Apache 2.0)",
            "NTFY_URL=https://ntfy.sh", "NTFY_TOPIC=replace-with-your-topic"]);
    }
    if f.schedule == ScheduleChoice::Rallly {
        lines.extend(&["# Rallly (scheduling polls)", "RALLLY_URL=http://localhost:3000"]);
    }

    if lines.is_empty() { String::new() }
    else { format!("\n# Optional integrations\n{}\n", lines.join("\n")) }
}

// ── config file stubs ─────────────────────────────────────────────────────────

pub(crate) fn feature_config_stubs(f: &AllFeatures) -> Vec<(&'static str, &'static str)> {
    let mut files: Vec<(&'static str, &'static str)> = Vec::new();
    match f.cms {
        CmsChoice::Keystatic => files.push((
            "keystatic.config.ts",
            "import { config } from '@keystatic/core';\n\nexport default config({\n  // Configure Keystatic here.\n  // See: https://keystatic.com/docs\n  collections: {},\n});\n",
        )),
        CmsChoice::Payload => files.push((
            "payload.config.ts",
            "import { buildConfig } from 'payload/config';\n\nexport default buildConfig({\n  // Configure Payload CMS here.\n  // See: https://payloadcms.com/docs/configuration/overview\n  collections: [],\n});\n",
        )),
        CmsChoice::Directus | CmsChoice::BuiltIn => {}
    }
    if f.commerce == CommerceChoice::Medusa {
        files.push(("medusa-config.js",
            "/** @type {import('@medusajs/medusa').ConfigModule} */\nmodule.exports = {\n  projectConfig: { databaseUrl: process.env.DATABASE_URL },\n  plugins: [],\n};\n",
        ));
    }
    if f.job_board {
        files.push(("content-types.example.ts", concat!(
            "// Uncomment and pass to registerCms({ contentTypes: [jobListingContentType] }).\n",
            "// export const jobListingContentType = {\n",
            "//   key: \"job\",\n",
            "//   label: \"Job Listing\",\n",
            "//   fields: [\n",
            "//     { name: \"company\",  label: \"Company\",         type: \"text\",   required: true },\n",
            "//     { name: \"location\", label: \"Location\",        type: \"text\" },\n",
            "//     { name: \"salary\",   label: \"Salary Range\",    type: \"text\" },\n",
            "//     { name: \"jobType\",  label: \"Type\",            type: \"select\",\n",
            "//       options: [\"full-time\",\"part-time\",\"contract\",\"remote\"] },\n",
            "//     { name: \"applyUrl\", label: \"Apply URL\",       type: \"text\" },\n",
            "//   ],\n",
            "// };\n",
        )));
    }
    files
}

// ── stack summary ─────────────────────────────────────────────────────────────

pub(crate) fn print_stack_summary(f: &AllFeatures, app_host: Option<AppHost>) {
    let host = match app_host {
        Some(AppHost::GithubPages)     => "GitHub Pages          (free, static)",
        Some(AppHost::CloudflarePages) => "Cloudflare Pages      (free, edge CDN)",
        Some(AppHost::Vercel)          => "Vercel                (free tier, serverless)",
        Some(AppHost::Netlify)         => "Netlify               (free tier, serverless)",
        Some(AppHost::RenderStatic)    => "Render static         (free tier)",
        Some(AppHost::RenderWeb)       => "Render web service    (free tier)",
        Some(AppHost::GitlabPages)     => "GitLab Pages          (free, static)",
        Some(AppHost::FirebaseHosting) => "Firebase Hosting      (free tier)",
        Some(AppHost::Runway)          => "Runway                (paid)",
        Some(AppHost::Custom) | None   => "custom / TBD",
    };
    println!();
    println!("  ─────────────────────────────────────────────────────");
    println!("    Your stack");
    println!("  ─────────────────────────────────────────────────────");
    println!("    Site          {host}");
    println!("    Admin panel   Astropress built-in");
    match f.cms {
        CmsChoice::BuiltIn   => println!("    Content       Astropress built-in (SQLite / D1 / Supabase)"),
        CmsChoice::Keystatic => println!("    Content       Keystatic          → git-backed, zero server"),
        CmsChoice::Directus  => println!("    Content       Directus           → Fly.io / Railway (free)"),
        CmsChoice::Payload   => println!("    Content       Payload            ⚠ needs a Node server (Fly.io / Railway free)"),
    }
    if f.email       == EmailChoice::Listmonk        { println!("    Email         Listmonk           → Fly.io / Railway (free)"); }
    match f.analytics {
        AnalyticsProvider::Umami     => println!("    Analytics     Umami              → Railway / Fly.io (free)"),
        AnalyticsProvider::Plausible => println!("    Analytics     Plausible          ⚠ cloud $9/mo; self-host free"),
        AnalyticsProvider::Matomo    => println!("    Analytics     Matomo             ⚠ cloud $23/mo; self-host free"),
        AnalyticsProvider::PostHog   => println!("    Analytics     PostHog            → free tier, then paid"),
        AnalyticsProvider::Custom    => println!("    Analytics     Custom"),
        AnalyticsProvider::None      => {}
    }
    if f.commerce    == CommerceChoice::Medusa       { println!("    Storefront    Medusa             → Fly.io / Railway (free)  ⚠ needs Node server"); }
    if f.courses     == CourseChoice::FrappeLms      { println!("    Courses       Frappe LMS         → Fly.io / Railway (free)"); }
    if f.testimonials == TestimonialChoice::Formbricks { println!("    Testimonials  Formbricks         → formbricks.com (free tier)"); }
    if f.donations   == DonationChoice::Polar        { println!("    Donations     Polar              → polar.sh (Apache 2.0, free tier)"); }
    if f.payments    == PaymentChoice::HyperSwitch   { println!("    Payments      HyperSwitch        → Fly.io / Railway (free); provider fees apply"); }
    if f.forum       == ForumChoice::Flarum          { println!("    Forum         Flarum             → Fly.io / Railway (free)"); }
    if f.chat        == ChatChoice::Chatwoot         { println!("    Live chat     Chatwoot           → Fly.io / Railway (free)"); }
    if f.notify      == NotifyChoice::Ntfy           { println!("    Push notify   ntfy               → ntfy.sh (free) or self-host"); }
    if f.schedule    == ScheduleChoice::Rallly       { println!("    Scheduling    Rallly             → Fly.io / Railway (free)"); }
    match f.community {
        CommunityChoice::Giscus   => println!("    Comments      Giscus             → zero server (GitHub Discussions)"),
        CommunityChoice::Remark42 => println!("    Comments      Remark42           → Fly.io (free)"),
        CommunityChoice::None     => {}
    }
    if f.search      == SearchChoice::Pagefind      { println!("    Search        Pagefind           → zero server, built at deploy time"); }
    match f.ab_testing {
        AbTestingProvider::GrowthBook => println!("    A/B testing   GrowthBook         → free cloud tier"),
        AbTestingProvider::Unleash    => println!("    A/B testing   Unleash            ⚠ cloud $80/mo; self-host free"),
        AbTestingProvider::Custom     => println!("    A/B testing   Custom"),
        AbTestingProvider::None       => {}
    }
    match f.heatmap {
        HeatmapProvider::OpenReplay => println!("    Replays       OpenReplay         → self-hosted"),
        HeatmapProvider::PostHog    => println!("    Replays       PostHog            → same script as analytics"),
        HeatmapProvider::Custom     => println!("    Replays       Custom"),
        HeatmapProvider::None       => {}
    }
    if f.job_board  { println!("    Job board     content type       → see content-types.example.ts"); }
    if f.enable_api { println!("    REST API      enabled            → /ap-api/v1/* (Bearer token)"); }
    println!("  ─────────────────────────────────────────────────────");
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── CMS choices ───────────────────────────────────────────────────────

    #[test]
    fn cms_default_is_builtin() {
        assert!(matches!(AllFeatures::defaults().cms, CmsChoice::BuiltIn));
    }

    #[test]
    fn payload_generates_config_stub() {
        let f = AllFeatures { cms: CmsChoice::Payload, ..AllFeatures::defaults() };
        let files = feature_config_stubs(&f);
        let paths: Vec<_> = files.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"payload.config.ts"), "expected payload.config.ts, got {paths:?}");
        let content = files.iter().find(|(p, _)| *p == "payload.config.ts").unwrap().1;
        assert!(content.contains("buildConfig"));
    }

    #[test]
    fn payload_generates_payload_secret_env_stub() {
        let f = AllFeatures { cms: CmsChoice::Payload, ..AllFeatures::defaults() };
        assert!(feature_env_stubs(&f).contains("PAYLOAD_SECRET"));
    }

    #[test]
    fn keystatic_generates_config_stub() {
        let f = AllFeatures { cms: CmsChoice::Keystatic, ..AllFeatures::defaults() };
        let files = feature_config_stubs(&f);
        let paths: Vec<_> = files.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"keystatic.config.ts"), "expected keystatic.config.ts, got {paths:?}");
        let content = files.iter().find(|(p, _)| *p == "keystatic.config.ts").unwrap().1;
        assert!(content.contains("@keystatic/core"));
    }

    #[test]
    fn directus_generates_env_stubs() {
        let f = AllFeatures { cms: CmsChoice::Directus, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("DIRECTUS_URL"));
        assert!(s.contains("DIRECTUS_TOKEN"));
    }

    #[test]
    fn builtin_cms_produces_no_stubs() {
        let f = AllFeatures::defaults(); // cms = BuiltIn, community = Giscus (no stubs)
        assert!(feature_env_stubs(&f).is_empty());
        assert!(feature_config_stubs(&f).is_empty());
    }

    // ── email ─────────────────────────────────────────────────────────────

    #[test]
    fn listmonk_generates_api_env_entries() {
        let f = AllFeatures { email: EmailChoice::Listmonk, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("LISTMONK_API_URL"));
        assert!(s.contains("LISTMONK_API_TOKEN"));
    }

    // ── commerce ──────────────────────────────────────────────────────────

    #[test]
    fn medusa_config_and_env_stubs() {
        let f = AllFeatures { commerce: CommerceChoice::Medusa, ..AllFeatures::defaults() };
        assert!(feature_env_stubs(&f).contains("MEDUSA_BACKEND_URL"));
        assert!(feature_config_stubs(&f).iter().any(|(p, _)| *p == "medusa-config.js"));
    }

    #[test]
    fn medusa_generates_medusa_backend_url_env_stub() {
        let f = AllFeatures { commerce: CommerceChoice::Medusa, ..AllFeatures::defaults() };
        assert!(feature_env_stubs(&f).contains("MEDUSA_BACKEND_URL"));
    }

    // ── community / comments ──────────────────────────────────────────────

    #[test]
    fn remark42_env_stubs() {
        let f = AllFeatures { community: CommunityChoice::Remark42, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("REMARK42_URL"));
        assert!(s.contains("REMARK42_SITE_ID"));
    }

    // ── search ────────────────────────────────────────────────────────────

    #[test]
    fn pagefind_adds_build_note() {
        let f = AllFeatures { search: SearchChoice::Pagefind, ..AllFeatures::defaults() };
        assert!(feature_env_stubs(&f).to_lowercase().contains("pagefind"));
    }

    // ── courses ───────────────────────────────────────────────────────────

    #[test]
    fn frappe_lms_generates_env_stubs() {
        let f = AllFeatures { courses: CourseChoice::FrappeLms, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("FRAPPE_LMS_URL"));
        assert!(s.contains("FRAPPE_LMS_API_KEY"));
    }

    // ── testimonials ──────────────────────────────────────────────────────

    #[test]
    fn formbricks_env_stubs() {
        let f = AllFeatures { testimonials: TestimonialChoice::Formbricks, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("FORMBRICKS_API_KEY"));
        assert!(s.contains("FORMBRICKS_ENVIRONMENT_ID"));
    }

    // ── donations ─────────────────────────────────────────────────────────

    #[test]
    fn polar_generates_env_stubs() {
        let f = AllFeatures { donations: DonationChoice::Polar, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("POLAR_ACCESS_TOKEN"));
        assert!(s.contains("POLAR_ORGANIZATION_ID"));
    }

    // ── forum ─────────────────────────────────────────────────────────────

    #[test]
    fn flarum_generates_env_stubs() {
        let f = AllFeatures { forum: ForumChoice::Flarum, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("FLARUM_URL"));
        assert!(s.contains("FLARUM_API_KEY"));
    }

    // ── live chat ─────────────────────────────────────────────────────────

    #[test]
    fn chatwoot_generates_env_stubs() {
        let f = AllFeatures { chat: ChatChoice::Chatwoot, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("CHATWOOT_URL"));
        assert!(s.contains("CHATWOOT_API_ACCESS_TOKEN"));
        assert!(s.contains("CHATWOOT_INBOX_ID"));
    }

    // ── payments ──────────────────────────────────────────────────────────

    #[test]
    fn hyperswitch_env_mentions_providers() {
        let f = AllFeatures { payments: PaymentChoice::HyperSwitch, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("HYPERSWITCH_API_KEY"));
        assert!(s.contains("Razorpay"), "should mention Razorpay (UPI/India)");
        assert!(s.contains("M-PESA"), "should mention M-PESA");
    }

    #[test]
    fn hyperswitch_env_includes_redirect_urls() {
        let f = AllFeatures { payments: PaymentChoice::HyperSwitch, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("PAYMENT_SUCCESS_REDIRECT_URL"));
        assert!(s.contains("PAYMENT_FAILURE_REDIRECT_URL"));
    }

    // ── notifications ─────────────────────────────────────────────────────

    #[test]
    fn ntfy_env_stubs() {
        let f = AllFeatures { notify: NotifyChoice::Ntfy, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("NTFY_URL"));
        assert!(s.contains("NTFY_TOPIC"));
    }

    // ── scheduling ────────────────────────────────────────────────────────

    #[test]
    fn rallly_generates_env_stubs() {
        let f = AllFeatures { schedule: ScheduleChoice::Rallly, ..AllFeatures::defaults() };
        assert!(feature_env_stubs(&f).contains("RALLLY_URL"));
    }

    // ── job board ─────────────────────────────────────────────────────────

    #[test]
    fn job_board_generates_content_type_stub() {
        let f = AllFeatures { job_board: true, ..AllFeatures::defaults() };
        let files = feature_config_stubs(&f);
        let file = files.iter().find(|(p, _)| *p == "content-types.example.ts");
        assert!(file.is_some(), "expected content-types.example.ts");
        assert!(file.unwrap().1.contains("jobListingContentType"));
    }
}
