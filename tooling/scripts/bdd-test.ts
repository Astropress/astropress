import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

type ScenarioDefinition = {
  featurePath: string;
  title: string;
};

type VerificationGroup = {
  label: string;
  scenarios: string[];
  steps: Array<{
    command: string;
    args: string[];
    cwd?: string;
  }>;
};

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const featuresRoot = path.join(repoRoot, "tooling", "bdd");
const astropressPackageRoot = path.join(repoRoot, "packages", "astropress");
const nexusPackageRoot = path.join(repoRoot, "packages", "astropress-nexus");
const cratesRoot = path.join(repoRoot, "crates");

function walkFeatureFiles(root: string, files: string[] = []) {
  for (const entry of readdirSync(root)) {
    const fullPath = path.join(root, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      walkFeatureFiles(fullPath, files);
      continue;
    }

    if (fullPath.endsWith(".feature")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function readFeatureScenarios() {
  const scenarios: ScenarioDefinition[] = [];

  for (const featureFile of walkFeatureFiles(featuresRoot)) {
    const relativePath = path.relative(repoRoot, featureFile).replaceAll(path.sep, "/");
    const lines = readFileSync(featureFile, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("Scenario:")) {
        scenarios.push({
          featurePath: relativePath,
          title: trimmed.slice("Scenario:".length).trim(),
        });
      }
    }
  }

  return scenarios;
}

async function runStep(step: VerificationGroup["steps"][number]) {
  const defaultCwd = step.command === "cargo" ? cratesRoot : repoRoot;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(step.command, step.args, {
      cwd: step.cwd ?? defaultCwd,
      stdio: "inherit",
      env: process.env,
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if ((code ?? 1) === 0) {
        resolve();
        return;
      }
      reject(new Error(`${step.command} ${step.args.join(" ")} exited with code ${code ?? 1}`));
    });
  });
}

const verificationGroups: VerificationGroup[] = [
  {
    label: "admin customization scenarios",
    scenarios: [
      "Site owners can customize admin branding without modifying package code",
      "Site owners can replace the admin logo and favicon without copying templates",
      "Site owners can restyle the admin panel without duplicating route files",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/admin-ui.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "admin i18n scenarios",
    scenarios: [
      "Admin UI displays labels in the site's configured locale",
      "Admin UI falls back to English for an unknown locale",
      "Admin UI falls back to English for an unknown label key",
      "BCP-47 locale tags with region code resolve to the base locale",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/admin-ui.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "non-technical admin scenarios",
    scenarios: [
      "Admin edits and publishes a post from the admin panel",
      "Admin manages redirects and uploads media from the same admin panel",
    ],
    steps: [
      {
        command: "bun",
        args: ["run", "test:accessibility:admin-harness"],
      },
    ],
  },
  {
    label: "WCAG 2.2 AA accessibility compliance",
    scenarios: [
      "All static admin routes pass axe WCAG 2.2 AA audit",
      "All public example routes pass axe WCAG 2.2 AA audit",
      "Admin panel meets keyboard navigation requirements",
      "Admin pages have correct heading hierarchy",
      "Form controls have accessible names",
      "Color contrast meets WCAG 2.2 AA thresholds",
    ],
    steps: [
      {
        command: "bun",
        args: ["run", "test:accessibility:admin-harness"],
      },
    ],
  },
  {
    label: "project bootstrap scenarios",
    scenarios: [
      "A developer running astropress new gets pre-filled environment variables for their chosen provider",
      "A developer can start local development immediately after running astropress new",
      "A developer creating a new project sees recommended hosting pairings matched to their chosen database",
      "A developer gets a generated DEPLOY.md with deploy steps specific to their chosen hosting provider",
    ],
    steps: [
      {
        command: "bunx",
        args: [
          "vitest",
          "run",
          "tests/project-scaffold.test.ts",
          "tests/project-env.test.ts",
          "tests/project-runtime.test.ts",
          "tests/project-launch.test.ts",
          "tests/provider-choice.test.ts",
          "tests/project-adapter.integration.test.ts",
        ],
        cwd: astropressPackageRoot,
      },
      {
        command: "cargo",
        args: ["test"],
      },
    ],
  },
  {
    label: "wordpress import scenarios",
    scenarios: [
      "An operator can review all imported posts and pages before they go live",
      "An operator receives a human-readable report after running astropress import wordpress",
      "An operator can resume an interrupted import without re-downloading already-saved media",
      "Content from WordPress with unusual status values is imported in a valid editorial state",
      "Special characters in WordPress content survive the import unchanged",
      "An operator receives a JSON report file summarising the import for automation and logging",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/wordpress-import.contract.test.ts", "tests/wordpress-import-branches.test.ts"],
        cwd: astropressPackageRoot,
      },
      {
        command: "cargo",
        args: ["test", "stages_wordpress_imports"],
      },
    ],
  },
  {
    label: "operator backup and restore scenarios",
    scenarios: [
      "Operator exports a project snapshot and restores it cleanly",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "exports_and_imports_project_snapshots"],
      },
    ],
  },
  {
    label: "health diagnostics scenarios",
    scenarios: [
      "Doctor reports missing local secrets and data-path warnings",
      "Doctor exits with a non-zero code in strict mode when warnings are present",
      "Doctor reports a clean bill of health for a fully configured project",
      "Session secret rotation keeps existing sessions valid during a two-phase deploy",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "doctor_reports_missing_local_runtime_warnings"],
      },
      {
        command: "cargo",
        args: ["test", "doctor_flags_weak_or_scaffolded_secrets"],
      },
      {
        command: "cargo",
        args: ["test", "bootstraps_and_verifies_content_services"],
      },
      {
        command: "bunx",
        args: [
          "vitest",
          "run",
          "tests/runtime-env.test.ts",
          "tests/runtime-admin-auth.test.ts",
          "tests/cloudflare-adapter-security.test.ts",
        ],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "admin mounting and consumer scenarios",
    scenarios: [
      "An admin can reach any section of the panel through the /ap-admin base path",
      "All admin form submissions stay within /ap-admin so operators expose one path in production",
      "A developer consuming AstroPress from a local package gets the same admin panel as a published install",
      "A developer consuming AstroPress from a local package gets the same routes as a published install",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/admin-routes.test.ts", "tests/tooling-integration.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "npm consumer admin route reachability",
    scenarios: [
      "All admin panel routes are reachable without source-level import aliases",
    ],
    steps: [
      {
        command: "bun",
        args: ["run", "test:consumer-smoke"],
        cwd: repoRoot,
      },
    ],
  },
  {
    label: "hosted provider selection scenarios",
    scenarios: [
      "A developer can switch to a hosted database provider without modifying any application code",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/hosted-provider.contract.test.ts", "tests/project-adapter.integration.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "provider portability scenarios",
    scenarios: [
      "A developer can move their site from one hosting provider to another by changing environment variables",
      "A deployed site connects to the right database based on environment variables alone",
    ],
    steps: [
      {
        command: "bunx",
        args: [
          "vitest",
          "run",
          "tests/local-provider.integration.test.ts",
          "tests/cloudflare-provider.integration.test.ts",
          "tests/deploy-and-sync.contract.test.ts",
          "tests/hosted-provider.contract.test.ts",
          "tests/project-adapter.integration.test.ts",
        ],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "sync command scenarios",
    scenarios: [
      "sync export produces a versioned content snapshot",
      "sync import applies a content snapshot to the local database",
      "sync export produces git-committable output",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/deploy-and-sync.contract.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "list tools command scenarios",
    scenarios: [
      "Developer runs astropress list tools and sees all categories",
      "Data providers section lists all supported providers",
      "App Hosts section lists all supported deployment targets",
      "Import Sources section lists all supported migration sources",
      "Integrations section lists tools grouped by add flag",
      "Running astropress list without a subcommand returns an error",
      "Running astropress list tools with an unknown extra argument returns an error",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "list_tools"],
      },
    ],
  },
  {
    label: "list providers command scenarios",
    scenarios: [
      "Developer runs astropress list providers and sees host categories",
      "Developer runs astropress list providers and sees data service categories",
      "App Hosts section lists all supported deployment targets",
      "Data Services section lists all supported providers",
      "Recommended pairings section lists best-supported combinations",
      "ls providers is an alias for list providers",
      "Running astropress list providers with an unknown extra argument returns an error",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "list_providers"],
      },
    ],
  },
  {
    label: "content persistence scenarios",
    scenarios: [
      "An editor's post status change is saved and immediately visible to all admin users",
      "An admin can see the file size of each uploaded image in the media library",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/cloudflare-adapter-full.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "wix live-site fetch scenarios",
    scenarios: [
      "Operator provides URL and is prompted for Wix credentials",
      "Successful blog post export via headless browser",
      "Crawl Wix pages not available in the blog export",
      "Wix login rejects invalid credentials",
      "Wix requires phone verification (2FA)",
      "CAPTCHA blocks automated Wix login",
      "Published site URL does not match any Wix account blog",
      "Page crawler reports failed pages without aborting the import",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/import/fetch-wix.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "wordpress live-site fetch scenarios",
    scenarios: [
      "Operator provides URL and is prompted for credentials",
      "Operator provides a credentials file to skip the prompt",
      "Successful export download via headless browser",
      "Also crawl site pages not included in the XML export",
      "Unreachable site reports DNS or connection failure verbosely",
      "URL is reachable but not a WordPress site",
      "Wrong credentials produce a clear login failure message",
      "Two-factor authentication blocks automated login",
      "CAPTCHA on login page prevents automated login",
      "Authenticated user lacks export permissions",
      "Interrupted media download resumes without re-fetching completed files",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/import/fetch-wordpress.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "playwright crawl mode scenarios",
    scenarios: [
      "Default --crawl-pages uses fast fetch mode",
      "--crawl-pages=playwright uses full browser crawl",
      "Playwright crawl handles navigation errors gracefully",
      "Developers can use the page crawler library to crawl JS-rendered sites programmatically",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/import/page-crawler.test.ts"],
        cwd: astropressPackageRoot,
      },
      {
        command: "cargo",
        args: ["test", "parses_crawl_modes"],
      },
    ],
  },
  {
    label: "email newsletter integration scenarios",
    scenarios: [
      "Listmonk admin is accessible from the Services tab",
      "Subscriber endpoint forwards to Listmonk API via newsletterAdapter",
      "NEWSLETTER_DELIVERY_MODE defaults to listmonk in production",
      "NEWSLETTER_DELIVERY_MODE defaults to mock in development",
      "Listmonk adapter returns error when configuration is incomplete",
      "Unrecognized delivery mode falls back to mock",
      "Listmonk service appears in scaffold prompts as the only email option",
      "astropress new generates LISTMONK.md when email is selected",
      "LISTMONK.md contains correct env var names",
      "POST /ap/newsletter/subscribe returns 200 for valid email",
      "POST /ap/newsletter/subscribe returns 400 for invalid email",
      "POST /ap/newsletter/subscribe returns 422 on adapter error",
      "Newsletter subscription records a conversion audit event",
      "Conversion audit event includes utm_source when present in query string",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/newsletter-adapter.test.ts", "tests/newsletter-subscribe.test.ts", "tests/services-config.test.ts"],
        cwd: astropressPackageRoot,
      },
      {
        command: "cargo",
        args: ["test", "--", "listmonk_generates_env_stubs", "listmonk_services_doc_covers_setup"],
      },
    ],
  },
  {
    label: "service tabs admin scenarios",
    scenarios: [
      "Services hub page shows all registered services",
      "Service provider page embeds the external admin UI in an iframe",
      "Navigating directly to an unconfigured provider returns a graceful error",
      "Services nav item appears in the sidebar for admin users",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/services-config.test.ts", "tests/admin-routes.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "service scaffold scenarios",
    scenarios: [
      // CMS / content backend
      "Interactive mode presents CMS choices",
      "Choosing Payload generates a payload.config.ts stub",
      "Choosing Keystatic generates a keystatic.config.ts stub",
      "Choosing Directus generates env stubs",
      // Commerce
      "Choosing Medusa generates a medusa-config.js stub",
      // Email
      "Choosing Listmonk generates env entries",
      // Testimonials
      "Choosing Formbricks generates testimonial env entries",
      // Courses
      "Choosing Frappe LMS generates course env entries",
      // Donations
      "Choosing Polar generates donation env entries",
      // Forum
      "Choosing Flarum generates forum env entries",
      // Live chat
      "Choosing Chatwoot generates live chat env entries",
      // Payments
      "Choosing HyperSwitch generates payment router env entries",
      "HyperSwitch env stubs name both API keys and all six regions",
      "HyperSwitch SERVICES.md connector table covers all payment regions",
      "HyperSwitch scaffolds a Unified Checkout component",
      // Push notifications
      "Choosing ntfy generates push notification env entries",
      // Scheduling
      "Choosing Rallly generates scheduling env entries",
      // Job board
      "Choosing job board scaffolds a content type stub",
      // Social cross-posting
      "Choosing Postiz generates social cross-posting env entries",
      "Choosing Mixpost generates social scheduling env entries",
      "Postiz SERVICES.md section covers all supported platforms",
      // Smart defaults
      "PostHog selected for analytics pre-selects PostHog for session replay",
      // Plain mode
      "Plain mode uses defaults without prompting",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "commands::new::tests"],
      },
      {
        command: "cargo",
        args: ["test", "features::tests"],
      },
      {
        command: "cargo",
        args: ["test", "features::tests_services"],
      },
      {
        command: "cargo",
        args: ["test", "strips_plain_flag_from_args"],
      },
    ],
  },
  {
    label: "post-import verification and telemetry scenarios",
    scenarios: [
      "Happy path skips feedback entirely",
      "Choosing \"c\" triggers browser crawl",
      "Choosing \"n\" offers a multi-select feedback form",
      "User declines to share feedback",
      "User consents to share feedback",
      "Consent is remembered so the prompt only appears once",
      "Plain mode skips all interactive prompts",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "strips_plain_flag_from_args"],
      },
      {
        command: "cargo",
        args: ["test", "stages_wordpress_imports"],
      },
      {
        command: "cargo",
        args: ["test", "parses_crawl_modes"],
      },
    ],
  },
  {
    label: "publishing and deployment scenarios",
    scenarios: [
      "A developer deploying to GitHub Pages gets a generated Actions workflow",
      "A developer deploying to Vercel or Cloudflare Pages uses provider-specific deploy scripts",
      "A developer can see which hosting and database combinations are fully supported",
      "CDN purge webhook fires when content is published",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/deploy-targets.test.ts", "tests/deployment-matrix.test.ts", "tests/deploy-and-sync.contract.test.ts", "tests/runtime-actions-content.test.ts"],
        cwd: astropressPackageRoot,
      },
      {
        command: "cargo",
        args: ["test", "deploy_script_selection_prefers_targeted_scripts"],
      },
    ],
  },
  {
    label: "author management scenarios",
    scenarios: [
      "An admin creates a new author profile so they can be credited on posts",
      "An admin updates an existing author's bio after they change their byline",
      "An admin removes an author who has left the organisation",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/author-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "content revision scenarios",
    scenarios: [
      "An editor can view the full revision history of a post before publishing",
      "An admin restores a previous content revision to undo unwanted changes",
    ],
    steps: [
      {
        command: "bunx",
        args: [
          "vitest", "run",
          "tests/content-repository-factory.test.ts",
          "tests/runtime-actions-content.test.ts",
          "tests/runtime-actions-media.test.ts",
          "tests/runtime-actions-misc.test.ts",
          "tests/runtime-actions-taxonomies.test.ts",
          "tests/runtime-actions-users.test.ts",
        ],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "admin dashboard scenarios",
    scenarios: [
      "Dashboard displays site activity summary on first load",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/admin-page-models.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "public comment submission scenarios",
    scenarios: [
      "A reader submits a comment on a post and it enters the moderation queue",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/comment-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "comment moderation scenarios",
    scenarios: [
      "A moderator approves a pending reader comment so it appears on the post",
      "A moderator rejects a spam comment so it is removed",
      "A moderator can manage comments through the package-owned comment repository",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/comment-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "redirect management scenarios",
    scenarios: [
      "Admin creates a 301 redirect from an old URL to a new one",
      "Admin creates a 302 temporary redirect",
      "Admin deletes a redirect that is no longer needed",
      "Admin cannot create a redirect where source and target are the same",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/redirect-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "contact form submission scenarios",
    scenarios: [
      "A visitor submits the contact form and their message is saved for the admin to read",
      "An admin can browse all contact submissions in the admin panel",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/submission-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "safe content rendering scenarios",
    scenarios: [
      "A reader viewing an imported post is not exposed to injected scripts",
      "Imported posts are sanitized to remove XSS vulnerabilities",
      "Off-screen images on a long post load lazily so the page appears quickly",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/html-sanitization.test.ts", "tests/html-optimization.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "site settings scenarios",
    scenarios: [
      "An admin updates the site title and the change is persisted",
      "Site settings are preserved across restarts",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/settings-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "multilingual content scenarios",
    scenarios: [
      "A reader can switch to the translated version of a page",
      "Search engines can discover all language versions through hreflang tags",
      "An editor can see which translated pages are current and which are out of date",
      "An editor creates content in two locales and both appear with correct hreflang links",
      "Accept-Language header negotiation selects the best configured locale",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/locale-links.test.ts", "tests/translation-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "taxonomy scenarios",
    scenarios: [
      "An editor assigns a category to a post and the post appears in that category's listing",
      "An editor can add new taxonomy terms and remove obsolete ones",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/taxonomy-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "user authentication scenarios",
    scenarios: [
      "Admin logs in with correct credentials and accesses the panel",
      "A session expires so that unattended logins do not remain active",
      "An admin can reset a forgotten password via an emailed link",
      "An admin can invite a new editor who sets their own password on first login",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/auth-repository-factory.test.ts", "tests/user-repository-factory.test.ts", "tests/admin-safety.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "site security and bot protection scenarios",
    scenarios: [
      "Admin pages cannot be embedded in an external site's iframe",
      "Rate limiter blocks clients exceeding the request threshold",
      "A bot submitting the contact form without solving CAPTCHA is rejected",
      "Admin pages use a stricter Content-Security-Policy than public pages",
      "Comment author email is hashed before storage",
      "Admin pages do not echo unsafe URLs from query parameters",
      "Invite and password-reset POST handlers reject requests with no origin evidence",
    ],
    steps: [
      {
        command: "bunx",
        args: [
          "vitest",
          "run",
          "tests/security-headers.test.ts",
          "tests/security-middleware.test.ts",
          "tests/rate-limit-repository-factory.test.ts",
          "tests/cloudflare-adapter-security.test.ts",
          "tests/privacy-invariants.test.ts",
          "tests/admin-link-utils.test.ts",
        ],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "concurrent editing protection scenarios",
    scenarios: [
      "Save is rejected when the record was modified after the editor opened it (HTTP 409)",
      "Save succeeds when lastKnownUpdatedAt matches the current updated_at",
      "Save proceeds normally when no lastKnownUpdatedAt is provided",
      "Editor sees a warning when another admin is already editing the same post",
      "Editor sees a stale-tab warning when another admin tab is editing the same post",
      "Stale-tab warning is cleared when the competing tab is closed",
      "Editor sees a stale-session warning when the page has been open too long",
    ],
    steps: [
      {
        command: "bunx",
        args: [
          "vitest",
          "run",
          "tests/runtime-actions-content.test.ts",
          "tests/content-repository-factory.test.ts",
          "tests/admin-safety.test.ts",
        ],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "media upload enforcement scenarios",
    scenarios: [
      "Upload is rejected when the file exceeds maxUploadBytes",
      "Upload is accepted when the file is within the maxUploadBytes limit",
      "Upload uses the 10 MiB default limit when maxUploadBytes is not configured",
      "Width and height are stored in media_assets on image upload",
      "Non-image uploads have null width and height in media_assets",
      "thumbnail_url column exists in media_assets schema",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/runtime-actions-media.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "content type field validation scenarios",
    scenarios: [
      "Save is rejected when a required custom field is missing",
      "Save succeeds when all required fields are provided",
      "Save succeeds when no contentType is registered for the templateKey",
      "Custom validate function can reject a field value",
      "Admin form auto-generates inputs for registered content type fields",
      "Admin form renders select inputs for select-type fields",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/runtime-actions-content.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "import failure recovery scenarios",
    scenarios: [
      "Interrupted WordPress import resumes without re-fetching completed media",
      "Failed import records are listed in the report for manual review",
      "Import can be restarted cleanly after a hard failure",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "stages_wordpress_imports"],
      },
      {
        command: "bunx",
        args: ["vitest", "run", "tests/wordpress-import.contract.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "audit logging scenarios",
    scenarios: [
      "Publishing a post creates an audit log entry",
      "Inviting a new user creates an audit log entry",
      "Audit log entries are immutable once written",
      "Audit log is visible to admins but not to editors",
      "Audit log entries older than auditRetentionDays are pruned on each write",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/runtime-actions-content.test.ts", "tests/runtime-actions-users.test.ts", "tests/audit-log.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "local development server scenarios",
    scenarios: [
      "A developer starts the local preview server with a single command",
      "A developer sees the admin credentials in the terminal on first run",
      "The CLI accepts a deploy target override from the environment",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "parses_top_level_commands"],
      },
      {
        command: "cargo",
        args: ["test", "scaffolds_new_project_from_example"],
      },
      {
        command: "cargo",
        args: ["test", "deploy_target_prefers_explicit_env_target"],
      },
    ],
  },
  {
    label: "service health and diagnostics scenarios",
    scenarios: [
      "An operator verifies that content services are reachable before going live",
      "An operator is told exactly which environment variables are missing",
      "An operator is warned when admin passwords are still set to weak placeholder values",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/content-services-ops.test.ts"],
        cwd: astropressPackageRoot,
      },
      {
        command: "cargo",
        args: ["test", "bootstraps_and_verifies_content_services"],
      },
      {
        command: "cargo",
        args: ["test", "doctor_flags_weak_or_scaffolded_secrets"],
      },
    ],
  },
  {
    label: "schema migration scenarios",
    scenarios: [
      "Operator applies new SQL migrations and skips already-applied ones",
      "Dry-run migration preview shows what would be applied without writing changes",
      "Migration runner handles a missing migrations directory gracefully",
      "rollback_sql is stored with each migration when a .down.sql companion file exists",
      "Doctor warns when the database schema is ahead of the framework version",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/db-migrate-ops.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "D1 schema migration scenarios",
    scenarios: [
      "Apply a pending migration to D1",
      "Skip an already-applied D1 migration",
      "Dry-run reports without writing",
      "Rollback the last D1 migration",
      "Rollback returns no_rollback_sql when no .down.sql was provided",
      "D1 migration report shape matches SQLite report shape",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/d1-migrate-ops.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "plugin API scenarios",
    scenarios: [
      "A plugin's onContentSave hook is called after content is saved",
      "A plugin's onContentPublish hook is called when content is published",
      "A failing plugin hook does not fail the admin action",
      "A plugin can register custom admin navigation items",
      "A plugin's onMediaUpload hook is called after a media asset is uploaded",
      "A failing onMediaUpload hook does not fail the upload action",
      "A plugin can inject a custom admin route via adminRoutes",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/plugin-api.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "domain separation scenarios",
    scenarios: [
      "Production static build contains no admin routes",
      "Admin domain serves the admin panel",
      "Public integration is a valid AstroIntegration",
      "Public integration accepts a buildHookSecret option",
      "Admin integration is unaffected by the new public integration",
      "Testimonials ingest endpoint is not injected by the public site integration",
      "Testimonials ingest endpoint is injected by the admin integration",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/public-site-integration.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "build-time content loading scenarios",
    scenarios: [
      "Published blog post is returned by the build-time loader",
      "Draft post is excluded when filtering by published status",
      "All posts are returned when no status filter is given",
      "Content kind filter works alongside status filter",
      "ContentListOptions pagination works correctly",
      "Build-time loader returns content shaped as ContentStoreRecord",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/build-time-content-loader.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "CMS editorial panel scenarios",
    scenarios: [
      "Self-hosted CMS embeds in the admin panel via iframe",
      "Cloud CMS shows an open button linking to the external panel",
      "No CMS configured hides the CMS nav item",
      "Editor cannot access the host infrastructure panel",
      "Admin can access the host infrastructure panel",
      "Unauthenticated user cannot access CMS or Host panels",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/cms-panel.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "publish workflow scenarios",
    scenarios: [
      "Admin triggers a production build via the Publish button",
      "Publish button is hidden when no deploy hook is configured",
      "Non-admin cannot trigger a publish",
      "GitHub Pages deploy hook fires a repository_dispatch event",
      "Cloudflare Pages deploy hook sends a POST to the deploy hook URL",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/deploy-trigger.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "draft preview scenarios",
    scenarios: [
      "Admin previews a draft post before it is published",
      "Draft post is not accessible on the production domain",
      "Unauthenticated visitor cannot access preview URLs on the admin domain",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/admin-preview.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "analytics and observability integration scenarios",
    scenarios: [
      "Analytics dashboard embeds in the admin panel via iframe",
      "Analytics configured in link mode shows an open button",
      "Analytics snippet helper returns correct script tag for Umami",
      "No analytics configured hides the analytics nav item",
      "AEO schema configuration is available on the SEO settings page",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/analytics-config.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "donation integration scenarios",
    scenarios: [
      "no donations configured returns empty snippets",
      "GiveLively config generates widget HTML",
      "GiveLively with campaign slug uses campaign identifier",
      "GiveLively without campaign slug falls back to org slug",
      "Liberapay config generates button HTML",
      "PledgeCrypto config generates widget HTML",
      "PledgeCrypto generates head script tag",
      "GiveLively suppressed when DNT opted out",
      "PledgeCrypto suppressed when DNT opted out",
      "Liberapay not suppressed when DNT opted out",
      "multiple providers can be enabled simultaneously",
      "JSON-LD DonateAction included when any provider enabled",
      "JSON-LD omitted when no providers configured",
      "env example includes GiveLively keys when enabled",
      "env example includes Liberapay key when enabled",
      "env example includes PledgeCrypto key when enabled",
      "env example omits donation keys when none enabled",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/donations-config.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "structured data / AEO JSON-LD scenarios",
    scenarios: [
      "AstropressFaqJsonLd emits valid FAQPage JSON-LD for a list of Q&A pairs",
      "AstropressFaqJsonLd renders nothing when items array is empty",
      "llms.txt endpoint lists published posts for AI crawlers",
      "AstropressBreadcrumbJsonLd emits valid BreadcrumbList JSON-LD",
      "AstropressHowToJsonLd emits valid HowTo JSON-LD for a step-by-step guide",
      "AstropressSpeakableJsonLd emits WebPage + SpeakableSpecification JSON-LD with CSS selectors",
      "AstropressSpeakableJsonLd emits XPath selectors as fallback",
      "Content with faqItems metadata auto-renders FAQPage JSON-LD without manual component wiring",
      "Content with howToSteps metadata auto-renders HowTo JSON-LD",
      "Content with speakableCssSelectors auto-renders SpeakableSpecification JSON-LD",
      "Content without AEO metadata renders no JSON-LD overhead",
      "AstropressSeoHead falls back to generated OG image when ogImage is not set",
      "Sitemap integration exports all published content URLs",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/public-site-integration.test.ts", "tests/aeo-metadata.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "image optimization / Core Web Vitals scenarios",
    scenarios: [
      "AstropressImage renders with explicit width, height, and aspect-ratio style",
      "AstropressImage defaults to loading=\"lazy\" and decoding=\"async\"",
      "AstropressImage renders srcset and sizes for responsive images",
      "AstropressImage supports fetchpriority=\"high\" for LCP images",
      "AstropressImage merges additional inline styles with aspect-ratio",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/public-site-integration.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "A/B testing integration scenarios",
    scenarios: [
      "GrowthBook dashboard embeds in the admin panel",
      "Unleash configured in link mode shows an open button",
      "No A/B testing configured hides the nav item",
      "CLI new command prompts for A/B testing provider selection",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/analytics-config.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "API token management scenarios",
    scenarios: [
      "Admin can create an API token with selected scopes",
      "API token verification succeeds for a valid unrevoked token",
      "Revoked API token is rejected",
      "Editor cannot access the API tokens management page",
      "API tokens page is hidden when API is not enabled",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/api-token-store.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "REST API for AI agents scenarios",
    scenarios: [
      "AI agent reads published content via REST API",
      "AI agent creates a new draft post via REST API",
      "AI agent paginates content using page and per_page parameters",
      "Request without Authorization header is rejected",
      "Token with insufficient scope is rejected",
      "OpenAPI spec is publicly accessible without authentication",
      "REST API endpoints return 404 when API is not enabled",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/api-routes.test.ts"],
        cwd: astropressPackageRoot,
      },
      {
        command: "bunx",
        args: ["vitest", "run", "tests/api-endpoints.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "webhook dispatch scenarios",
    scenarios: [
      "Admin registers a webhook for content publish events",
      "Webhook receives a signed payload when content is published",
      "Webhook failure does not block the originating operation",
      "Deleted webhook no longer receives events",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/webhook-store.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "content scheduling scenarios",
    scenarios: [
      "Editor schedules a post for future publication",
      "Scheduler publishes content when its scheduled time arrives",
      "Editor can cancel a scheduled publish",
      "Scheduling a post does not immediately publish it",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/content-scheduling.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "install script scenarios",
    scenarios: [
      "Install script creates project .env with generated secrets",
      "Install script runs bun install in the project directory",
      "Install script exits non-zero on missing bun",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "scaffolds_new_project_from_example"],
      },
    ],
  },
  {
    label: "nexus gateway health scenarios",
    scenarios: [
      "Health endpoint returns all registered sites with status",
      "Sites endpoint lists registered sites with live health",
      "Single site endpoint returns site metadata",
      "Unknown site returns 404",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/app.test.ts"],
        cwd: nexusPackageRoot,
      },
    ],
  },
  {
    label: "nexus gateway proxy scenarios",
    scenarios: [
      "Proxy routes content request to the correct member site",
      "Proxy routes settings request to the correct member site",
      "Proxy routes media request to the correct member site",
      "Proxy returns 404 for an unknown site",
      "Degraded site is surfaced without failing the gateway",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/app.test.ts"],
        cwd: nexusPackageRoot,
      },
    ],
  },
  {
    label: "nexus gateway fan-out scenarios",
    scenarios: [
      "Fan-out content query returns results from all available sites",
      "Fan-out continues when one site is degraded",
      "Metrics endpoint aggregates counts across all sites",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/app.test.ts"],
        cwd: nexusPackageRoot,
      },
    ],
  },
  {
    label: "nexus gateway auth scenarios",
    scenarios: [
      "Request without token is rejected",
      "Request with wrong token is rejected",
      "Request with correct token is accepted",
      "Health endpoint does not require auth",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/app.test.ts"],
        cwd: nexusPackageRoot,
      },
    ],
  },
  {
    label: "astropress add command scenarios",
    scenarios: [
      "astropress add --analytics umami appends env stubs to .env.example",
      "astropress add --email listmonk generates LISTMONK.md and middleware",
      "astropress add --forum flarum appends env stubs to .env.example",
      "astropress add --notify gotify appends env stubs to .env.example",
      "astropress add --schedule calcom appends env stubs to .env.example",
      "astropress add --commerce vendure appends env stubs to .env.example",
      "astropress add --chat tiledesk appends env stubs to .env.example",
      "astropress add with an unrecognised flag returns a clear error",
      "astropress add to a directory that does not exist returns an error",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "--", "add_analytics", "add_email", "add_forum", "add_notify", "add_schedule", "add_commerce", "add_chat", "add_to_nonexistent", "add_with_unknown"],
      },
    ],
  },
  {
    label: "astropress add --docs scenarios",
    scenarios: [
      "astropress add --docs starlight integrates Starlight inline into the Astro project",
      "astropress add --docs vitepress scaffolds a VitePress docs site",
      "astropress add --docs mdbook scaffolds an mdBook docs site",
      "astropress add --docs with an unknown generator returns a clear error",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "--", "add_docs_starlight", "add_docs_vitepress", "add_docs_mdbook", "add_docs_unknown"],
      },
    ],
  },
  {
    label: "Settings tabs — import and newsletter restructuring",
    scenarios: [
      "Settings page shows General tab by default",
      "Settings Newsletter tab shows subscriber list and Mailchimp import form",
      "Settings Import tab shows WordPress, Wix, and crawl source cards",
      "/ap-admin/import redirects to Settings Import tab",
      "/ap-admin/subscribers redirects to Settings Newsletter tab",
      "Import and Subscribers are not top-level sidebar nav items",
      "Mailchimp CSV import uploads and returns imported count",
    ],
    steps: [
      {
        command: "bun",
        args: ["test", "--", "settings-tabs"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "Undo toast after deleting admin resources",
    scenarios: [
      "Deleting a resource shows an undo toast",
      "Clicking Undo restores the deleted resource",
      "Undo toast disappears after a few seconds",
    ],
    steps: [
      {
        command: "bun",
        args: ["test", "--", "delete-undo"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "destructive action confirmation dialogs",
    scenarios: [
      "Admin confirms before deleting an author",
      "Admin confirms before deleting a category",
      "Admin confirms before deleting a tag",
      "Admin confirms before deleting a media asset",
      "Admin confirms before deleting a webhook",
      "Admin confirms before revoking an API token",
      "Admin confirms before suspending a user",
      "Admin confirms before purging user data",
      "Admin confirms before removing a subscriber",
      "Submitting a form disables the button to prevent duplicate actions",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/admin-safety.test.ts", "tests/admin-shell-ux.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "header utility panel",
    scenarios: [
      "Topbar keeps utility controls behind a single toggle",
      "Opening the toggle reveals four utility buttons",
      "Panel sits inside the topbar without covering other header items",
      "Clicking the toggle again closes the panel",
      "Panel closes when I click outside or press Escape",
      "Theme toggle icon reflects the mode it will switch to",
      "Scroll button takes me to the bottom or back to the top",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/admin-shell-ux.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "Admin command palette",
    scenarios: [
      "Pressing Ctrl+K opens the command palette",
      "Typing in the palette filters nav items",
      "Pressing Enter on a selected result navigates to that page",
      "Pressing Escape closes the palette",
    ],
    steps: [
      {
        command: "bun",
        args: ["test", "--", "command-palette"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "astropress migrate command scenarios",
    scenarios: [
      "astropress migrate --from rallly --to calcom generates a migration guide",
      "astropress migrate --from medusa --to vendure generates a migration guide",
      "astropress migrate --from flarum --to discourse generates a migration guide",
      "astropress migrate --from ntfy --to gotify generates a migration guide",
      "astropress migrate --from keystatic --to payload generates a migration guide",
      "astropress migrate --from umami --to plausible generates a migration guide",
      "astropress migrate --from and --to the same tool returns an error",
      "astropress migrate between incompatible categories returns an error",
      "astropress migrate with an unknown tool name returns an error",
      "astropress migrate --dry-run prints the migration guide without writing files",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "--", "migrate_rallly", "migrate_medusa", "migrate_flarum", "migrate_ntfy", "migrate_keystatic", "migrate_umami", "migrate_same_tool", "migrate_incompatible", "migrate_unknown", "migrate_dry_run"],
      },
    ],
  },
  {
    label: "auth emergency-revoke CLI scenarios",
    scenarios: [
      "--all revokes every active session and API token",
      "--sessions-only revokes sessions without touching tokens",
      "--tokens-only revokes API tokens without touching sessions",
      "--all --user scopes revocation to a single user's sessions",
      "--all prints a bootstrap password warning",
      "Running without a scope flag returns a clear usage error",
    ],
    steps: [
      {
        command: "cargo",
        args: [
          "test",
          "--",
          "auth_emergency_revoke_all_parses",
          "auth_emergency_revoke_sessions_only_parses",
          "auth_emergency_revoke_tokens_only_parses",
          "auth_emergency_revoke_user_scoping_parses",
          "auth_emergency_revoke_bootstrap_warning_scope",
          "auth_emergency_revoke_no_scope_returns_error",
        ],
      },
    ],
  },
];

const scenarios = readFeatureScenarios();
const featureScenarioTitles = new Set(scenarios.map((scenario) => scenario.title));
const coveredScenarioTitles = new Set(verificationGroups.flatMap((group) => group.scenarios));
const unassignedScenarios = scenarios.filter((scenario) => !coveredScenarioTitles.has(scenario.title));
const unknownScenarioTitles = [...coveredScenarioTitles].filter((title) => !featureScenarioTitles.has(title));

if (unassignedScenarios.length > 0 || unknownScenarioTitles.length > 0) {
  const issues = [
    ...unassignedScenarios.map((scenario) => `Unassigned scenario: ${scenario.featurePath} -> ${scenario.title}`),
    ...unknownScenarioTitles.map((title) => `Verification references unknown scenario: ${title}`),
  ];
  console.error("BDD execution map is incomplete:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

for (const group of verificationGroups) {
  console.log(`Running ${group.label}...`);
  for (const step of group.steps) {
    await runStep(step);
  }

  for (const scenarioTitle of group.scenarios) {
    const scenario = scenarios.find((candidate) => candidate.title === scenarioTitle);
    console.log(`  PASS ${scenario?.featurePath ?? "features"} :: ${scenarioTitle}`);
  }
}

console.log(`BDD execution passed for ${scenarios.length} scenarios across ${verificationGroups.length} verification groups.`);
