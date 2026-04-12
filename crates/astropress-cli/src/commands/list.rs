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

// ── tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::list_tools;

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
        // Calling list_tools() must not panic.
        let result = capture_list_tools();
        assert_eq!(result, "ok");
    }
}
