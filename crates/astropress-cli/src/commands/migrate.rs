//! `astropress migrate` — generate a step-by-step migration guide for
//! switching from one integration to another in the same category.
//!
//! Usage: `astropress migrate [dir] --from <tool> --to <tool> [--dry-run]`
//!
//! Generates a `MIGRATE-<to>.md` file in the project directory with
//! actionable steps. Use `--dry-run` to print the guide without writing.

// ── tool registry ─────────────────────────────────────────────────────────────

/// A migration tool identified by its CLI slug.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct MigrationTool {
    /// Slug used on the CLI (e.g. "rallly", "calcom").
    pub slug: &'static str,
    /// Human-readable display name.
    pub name: &'static str,
    /// Category — only tools in the same category can be migrated between.
    pub category: &'static str,
    /// One-line description of the tool.
    pub description: &'static str,
}

/// All tools that support `astropress migrate`.
/// AstroPress built-in CMS is excluded — it is not an optional integration
/// and has no migration path (it is the default starting point).
const TOOLS: &[MigrationTool] = &[
    // ── scheduling ────────────────────────────────────────────────────────────
    MigrationTool { slug: "rallly",    name: "Rallly",    category: "scheduling",
        description: "Availability polling (MIT; no-account group scheduling)" },
    MigrationTool { slug: "calcom",    name: "Cal.com",   category: "scheduling",
        description: "Full booking + calendar integrations (AGPL 3.0)" },
    // ── commerce ─────────────────────────────────────────────────────────────
    MigrationTool { slug: "medusa",    name: "Medusa",    category: "commerce",
        description: "Headless commerce with Stripe + product catalog (MIT)" },
    MigrationTool { slug: "vendure",   name: "Vendure",   category: "commerce",
        description: "TypeScript-first headless commerce; GraphQL API (MIT)" },
    // ── forum ─────────────────────────────────────────────────────────────────
    MigrationTool { slug: "flarum",    name: "Flarum",    category: "forum",
        description: "Lightweight forum; REST API (MIT; PHP)" },
    MigrationTool { slug: "discourse", name: "Discourse", category: "forum",
        description: "Mature forum with moderation tools + email digests (GPL 2.0; Ruby)" },
    // ── notifications ─────────────────────────────────────────────────────────
    MigrationTool { slug: "ntfy",      name: "ntfy",      category: "notifications",
        description: "Pub/sub HTTP push; single Go binary (Apache 2.0)" },
    MigrationTool { slug: "gotify",    name: "Gotify",    category: "notifications",
        description: "Simple self-hosted push; REST API + WebSocket (MIT)" },
    // ── cms ───────────────────────────────────────────────────────────────────
    MigrationTool { slug: "keystatic", name: "Keystatic", category: "cms",
        description: "Git-backed JSON/YAML; zero server (MIT)" },
    MigrationTool { slug: "payload",   name: "Payload",   category: "cms",
        description: "TypeScript-first headless CMS; full schema control (MIT)" },
    // ── analytics ─────────────────────────────────────────────────────────────
    MigrationTool { slug: "umami",     name: "Umami",     category: "analytics",
        description: "Simple page views + events; no cookie banner (MIT)" },
    MigrationTool { slug: "plausible", name: "Plausible", category: "analytics",
        description: "Polished dashboard; EU data residency (AGPL; cloud $9/mo or self-host)" },
    MigrationTool { slug: "matomo",    name: "Matomo",    category: "analytics",
        description: "Full GA replacement + GDPR consent tools (GPL; cloud $23/mo or self-host)" },
    MigrationTool { slug: "posthog",   name: "PostHog",   category: "analytics",
        description: "Analytics + feature flags + session replay (MIT; generous free tier)" },
    // ── chat ─────────────────────────────────────────────────────────────────
    MigrationTool { slug: "tiledesk",  name: "Tiledesk",  category: "chat",
        description: "Live chat + chatbot + helpdesk; REST + webhook API (Apache 2.0)" },
    // ── search ────────────────────────────────────────────────────────────────
    MigrationTool { slug: "pagefind",    name: "Pagefind",    category: "search",
        description: "Static index at deploy time; zero server (Apache 2.0)" },
    MigrationTool { slug: "meilisearch", name: "Meilisearch", category: "search",
        description: "Typo-tolerant full-text search API; real-time updates (MIT)" },
    // ── comments ─────────────────────────────────────────────────────────────
    MigrationTool { slug: "giscus",    name: "Giscus",    category: "comments",
        description: "GitHub Discussions as comments; zero server (MIT)" },
    MigrationTool { slug: "remark42",  name: "Remark42",  category: "comments",
        description: "Self-hosted; no social login required (MIT)" },
    // ── forms ─────────────────────────────────────────────────────────────
    MigrationTool { slug: "formbricks", name: "Formbricks", category: "forms",
        description: "Surveys + testimonials + referral capture + NPS flows (MIT community edition)" },
    MigrationTool { slug: "typebot",    name: "Typebot",    category: "forms",
        description: "Conversational testimonial and referral capture flows (AGPL 3.0)" },
    // ── video ─────────────────────────────────────────────────────────────
    MigrationTool { slug: "peertube",  name: "PeerTube",  category: "video",
        description: "Self-hosted video with embeds + ActivityPub (AGPL 3.0)" },
    // ── podcast ───────────────────────────────────────────────────────────
    MigrationTool { slug: "castopod",  name: "Castopod",  category: "podcast",
        description: "Self-hosted podcast hosting; RSS + embeddable player (AGPL 3.0)" },
    // ── events ────────────────────────────────────────────────────────────
    MigrationTool { slug: "hievents",  name: "Hi.Events", category: "events",
        description: "Event pages, RSVP, ticket sales (AGPL 3.0)" },
    MigrationTool { slug: "pretix",    name: "Pretix",    category: "events",
        description: "Established ticketing with seating charts (Apache 2.0)" },
    // ── transactional email ───────────────────────────────────────────────
    MigrationTool { slug: "resend",    name: "Resend",    category: "transactional-email",
        description: "Hosted transactional email API with a direct Astropress integration" },
    MigrationTool { slug: "smtp",      name: "SMTP relay", category: "transactional-email",
        description: "Generic SMTP contract for Postal, Brevo SMTP, SES, Mailgun, and similar providers" },
    // ── status ────────────────────────────────────────────────────────────
    MigrationTool { slug: "uptime-kuma", name: "Uptime Kuma", category: "status",
        description: "Uptime monitoring + public status page (MIT)" },
    // ── knowledge base ────────────────────────────────────────────────────
    MigrationTool { slug: "bookstack", name: "BookStack", category: "knowledge-base",
        description: "Structured wiki and docs (MIT)" },
    // ── crm ───────────────────────────────────────────────────────────────
    MigrationTool { slug: "twenty",    name: "Twenty",    category: "crm",
        description: "Modern open-source CRM (AGPL 3.0)" },
    // ── sso ───────────────────────────────────────────────────────────────
    MigrationTool { slug: "authentik", name: "Authentik", category: "sso",
        description: "Identity provider; social login, MFA, LDAP (MIT)" },
    MigrationTool { slug: "zitadel",   name: "Zitadel",   category: "sso",
        description: "Hosted-or-self-hosted identity; fine-grained org roles (Apache 2.0)" },
];

fn find_tool(slug: &str) -> Option<&'static MigrationTool> {
    TOOLS.iter().find(|t| t.slug == slug)
}

// ── guide generation ──────────────────────────────────────────────────────────

fn build_migration_guide(from: &MigrationTool, to: &MigrationTool) -> String {
    format!(
        "# Migration guide: {from_name} → {to_name}\n\
         \n\
         ## Overview\n\
         \n\
         | | From | To |\n\
         |---|---|---|\n\
         | Tool | {from_name} | {to_name} |\n\
         | Category | {category} | {category} |\n\
         | Description | {from_desc} | {to_desc} |\n\
         \n\
         ## Steps\n\
         \n\
         ### 1. Deploy {to_name}\n\
         \n\
         Follow the {to_name} setup instructions to get a running instance.\n\
         Update your `.env` (and `.env.example`) to replace the {from_name} env\n\
         vars with the {to_name} env vars shown below.\n\
         \n\
         ### 2. Update environment variables\n\
         \n\
         Remove or comment out the `{from_slug}` vars and add the `{to_slug}` vars:\n\
         \n\
         ```sh\n\
         # Remove:\n\
         # {from_env_hint}\n\
         \n\
         # Add:\n\
         # {to_env_hint}\n\
         ```\n\
         \n\
         Run `astropress add . --{category} {to_slug}` to append the new env stubs\n\
         to `.env.example` automatically.\n\
         \n\
         ### 3. Update your project configuration\n\
         \n\
         - Search your codebase for references to `{from_slug}` and update them to\n\
           use the {to_name} API or SDK.\n\
         - Remove any {from_name}-specific config files (e.g. `{from_slug}.config.*`).\n\
         \n\
         ### 4. Migrate data (if applicable)\n\
         \n\
         Export your data from {from_name} using its built-in export tools and import\n\
         into {to_name}. Refer to the {to_name} documentation for import formats.\n\
         \n\
         ### 5. Verify\n\
         \n\
         Run `astropress services verify` to confirm the new integration is\n\
         correctly configured.\n\
         \n\
         ### 6. Remove {from_name}\n\
         \n\
         Once {to_name} is confirmed working, decommission your {from_name} instance\n\
         to avoid unnecessary costs.\n\
         \n\
         ---\n\
         \n\
         _Generated by `astropress migrate --from {from_slug} --to {to_slug}`_\n",
        from_name = from.name,
        to_name = to.name,
        category = from.category,
        from_slug = from.slug,
        to_slug = to.slug,
        from_desc = from.description,
        to_desc = to.description,
        from_env_hint = format_args!("{}_*", from.slug.to_uppercase().replace('-', "_")),
        to_env_hint   = format_args!("{}_*", to.slug.to_uppercase().replace('-', "_")),
    )
}

// ── main entry point ──────────────────────────────────────────────────────────

/// Parse and validate `--from` / `--to` / `--dry-run` args.
pub(crate) struct MigrateOptions {
    pub project_dir: std::path::PathBuf,
    pub from: String,
    pub to: String,
    pub dry_run: bool,
}

pub(crate) fn run_migrate(opts: &MigrateOptions) -> Result<(), String> {
    let from_tool = find_tool(&opts.from)
        .ok_or_else(|| format!(
            "Unknown tool `{}`. Run `astropress migrate --help` for supported tools.",
            opts.from
        ))?;
    let to_tool = find_tool(&opts.to)
        .ok_or_else(|| format!(
            "Unknown tool `{}`. Run `astropress migrate --help` for supported tools.",
            opts.to
        ))?;

    if from_tool.slug == to_tool.slug {
        return Err(format!(
            "Source and destination are both `{}` — nothing to migrate.",
            from_tool.slug
        ));
    }

    if from_tool.category != to_tool.category {
        return Err(format!(
            "`{}` ({}) and `{}` ({}) are in different categories; migration is not supported.",
            from_tool.slug, from_tool.category,
            to_tool.slug,   to_tool.category,
        ));
    }

    let guide = build_migration_guide(from_tool, to_tool);

    if opts.dry_run {
        println!("{guide}");
        return Ok(());
    }

    if !opts.project_dir.exists() { // ~ skip
        return Err(format!(
            "Project directory `{}` does not exist.",
            opts.project_dir.display()
        ));
    }

    let filename = format!("MIGRATE-{}.md", to_tool.slug);
    let output_path = opts.project_dir.join(&filename);
    std::fs::write(&output_path, &guide)
        .map_err(|e| format!("Could not write {filename}: {e}"))?;
    println!("Wrote {}", output_path.display());
    println!("Review the guide and follow the steps to complete the migration.");

    Ok(())
}

#[cfg(test)]
#[path = "migrate_tests.rs"]
mod tests;
