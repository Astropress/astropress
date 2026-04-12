//! `astropress list tools` — display all available tool options by category.
//!
//! Prints a categorised reference of every data provider, app host, import
//! source, and optional integration the CLI knows about, together with the
//! flag or subcommand used to select each one.

/// Print the full tool catalogue to stdout.
pub(crate) fn list_tools() {
    println!("astropress tool catalogue");
    println!();

    // ── Data Providers ────────────────────────────────────────────────────────
    println!("Data Providers   (--content-services <provider> during `astropress new`)");
    println!("  none           Built-in SQLite — local file, zero sign-up (default)");
    println!("  cloudflare     Cloudflare D1 + R2 — edge SQL + object storage");
    println!("  supabase       Supabase — hosted Postgres, generous free tier");
    println!("  neon           Neon — serverless Postgres with branching");
    println!("  nhost          Nhost — GraphQL + Postgres, open-source Firebase alternative");
    println!("  pocketbase     PocketBase — single binary, self-hosted");
    println!("  appwrite       Appwrite — self-hosted BaaS");
    println!("  runway         Runway — managed platform");
    println!("  custom         Bring your own adapter");
    println!();

    // ── App Hosts ─────────────────────────────────────────────────────────────
    println!("App Hosts   (--app-host <host> during `astropress new` or `astropress deploy`)");
    println!("  github-pages       GitHub Pages — static, free");
    println!("  cloudflare-pages   Cloudflare Pages — static + edge functions, generous free tier");
    println!("  vercel             Vercel — serverless, generous free tier");
    println!("  netlify            Netlify — serverless, generous free tier");
    println!("  render-static      Render Static Site — free tier");
    println!("  render-web         Render Web Service — persistent server");
    println!("  gitlab-pages       GitLab Pages — static, free");
    println!("  runway             Runway — managed platform");
    println!("  custom             Any custom deployment target");
    println!();

    // ── Import Sources ────────────────────────────────────────────────────────
    println!("Import Sources   (`astropress import <source>`)");
    println!("  wordpress    WordPress XML export — full content + media import");
    println!("  wix          Wix site — CSV export or live browser crawl");
    println!();

    // ── Integrations ──────────────────────────────────────────────────────────
    println!("Integrations   (add to an existing project with `astropress add --<flag> <value>`)");
    println!("  --analytics          umami, plausible, matomo, posthog, custom");
    println!("  --heatmap            posthog, custom");
    println!("  --ab-testing         growthbook, unleash, custom");
    println!("  --cms                keystatic, payload");
    println!("  --email              listmonk");
    println!("  --transactional-email  brevo, postal");
    println!("  --commerce           medusa, vendure");
    println!("  --payments           hyperswitch");
    println!("  --community          giscus, remark42");
    println!("  --search             pagefind, meilisearch");
    println!("  --forum              flarum, discourse");
    println!("  --chat               tiledesk");
    println!("  --schedule           rallly, calcom");
    println!("  --notify             ntfy, gotify");
    println!("  --courses            frappe-lms");
    println!("  --forms              formbricks, typebot");
    println!("  --donations          polar, give-lively, liberapay, pledge-crypto");
    println!("  --video              peertube");
    println!("  --podcast            castopod");
    println!("  --events             hievents, pretix");
    println!("  --status             uptime-kuma");
    println!("  --knowledge-base     bookstack");
    println!("  --crm                twenty");
    println!("  --sso                authentik, zitadel");
}

/// Print the provider catalogue to stdout, organised by hosting category.
///
/// Covers app hosts (static, serverless, server, managed), data services
/// (edge, serverless Postgres, self-hosted BaaS, built-in), and the fully-
/// tested host+data pairings.
pub(crate) fn list_providers() {
    println!("astropress provider catalogue");
    println!();

    // ── App Hosts ─────────────────────────────────────────────────────────────
    println!("App Hosts   (--app-host <host> during `astropress new` or `astropress deploy`)");
    println!();
    println!("  Static — free, no server required");
    println!("    github-pages       GitHub Pages: zero-config, free forever, 1 GB limit");
    println!("    gitlab-pages       GitLab Pages: zero-config, free forever");
    println!("    cloudflare-pages   Cloudflare Pages: static + edge functions, 500 builds/month free");
    println!("    netlify            Netlify: static + serverless, 300 build-minutes/month free");
    println!("    vercel             Vercel: static + serverless, 6 000 build-minutes/month free");
    println!("    render-static      Render Static: static, 100 GB bandwidth free");
    println!();
    println!("  Server — persistent runtime");
    println!("    render-web         Render Web Service: always-on; free tier spins down on idle");
    println!();
    println!("  Managed — single-provider, fully hosted");
    println!("    runway             Runway: managed Astropress platform");
    println!();
    println!("  Bring your own");
    println!("    custom             Any target — supply your own deploy script");
    println!();

    // ── Data Services ─────────────────────────────────────────────────────────
    println!("Data Services   (--content-services <provider> during `astropress new`)");
    println!();
    println!("  Edge / global");
    println!("    cloudflare         Cloudflare D1 + R2: SQL at the edge, 5 GB free (pairs with cloudflare-pages)");
    println!();
    println!("  Serverless Postgres");
    println!("    supabase           Supabase: Postgres + Auth + Storage, 500 MB free (recommended)");
    println!("    neon               Neon: serverless Postgres with branching, 0.5 GB free");
    println!("    nhost              Nhost: GraphQL + Postgres + Auth, open-source Firebase alternative");
    println!();
    println!("  Self-hosted BaaS");
    println!("    pocketbase         PocketBase: single-binary, self-hosted, zero cloud cost");
    println!("    appwrite           Appwrite: Docker Compose BaaS, self-hosted or cloud");
    println!();
    println!("  Built-in (default)");
    println!("    none               SQLite: local file, zero sign-up, works offline (pairs with github-pages)");
    println!();
    println!("  Managed");
    println!("    runway             Runway: managed database included with Runway hosting");
    println!();

    // ── Recommended pairings ──────────────────────────────────────────────────
    println!("Recommended pairings   (fully tested host + data combinations)");
    println!();
    println!("  github-pages     + none         Pure static — zero infrastructure, free forever");
    println!("  cloudflare-pages + cloudflare   Edge SQL — global, fast; Cloudflare account required");
    println!("  vercel           + supabase     Serverless + Postgres — generous free tiers");
    println!("  netlify          + supabase     Serverless + Postgres — generous free tiers");
    println!("  render-web       + supabase     Server + Postgres — persistent runtime, always-on");
    println!("  runway           + runway       Fully managed — one provider handles everything");
    println!();
    println!("Preview pairings   (work but not officially tested end-to-end)");
    println!();
    println!("  github-pages     + supabase     Static site with external Postgres API");
    println!("  gitlab-pages     + supabase     Same as above on GitLab");
    println!("  cloudflare-pages + supabase     Edge pages + Supabase Postgres");
    println!("  vercel           + appwrite      Serverless + self-hosted BaaS");
    println!("  netlify          + appwrite      Serverless + self-hosted BaaS");
    println!("  render-web       + appwrite      Server + self-hosted BaaS");
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::{list_providers, list_tools};

    fn capture_list_tools() -> String {
        // list_tools() prints to stdout. We verify the function runs without
        // panicking; output content is verified in the integration tests that
        // capture the CLI process stdout (via cargo test list_tools_*).
        // Here we just confirm the function is callable and returns normally.
        list_tools();
        // Return a sentinel so callers can assert the call completed.
        "ok".to_string()
    }

    #[test]
    fn list_tools_runs_without_panic() {
        let result = capture_list_tools();
        assert_eq!(result, "ok");
    }

    #[test]
    fn list_providers_runs_without_panic() {
        list_providers();
    }
}
