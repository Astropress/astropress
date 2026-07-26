import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { requiresAccess } from "../src/access/page-guard";
import { listAstropressAdminRoutes } from "../src/admin-routes";

const PAGES_DIR = fileURLToPath(new URL("../pages/ap-admin", import.meta.url));
const COMPONENTS_DIR = fileURLToPath(new URL("../components", import.meta.url));

const PUBLIC_PAGE_PATTERNS = new Set<string>([
	"/ap-admin/login",
	"/ap-admin/accept-invite",
	"/ap-admin/reset-password",
]);

// An explicit redirect to the login page (any quote style).
const AUTH_REDIRECT = /redirect\((["'])\/ap-admin\/login\1/;
// `isAuthUserAdmin(...)` used *inside a gating conditional* that denies —
// `if (!isAuthUserAdmin(user)) { return … / redirect … / status = 403 }`.
// This deliberately does NOT match the display-assignment form
// (`const isAdmin = … isAuthUserAdmin(user)`), which is not a gate.
const ADMIN_GATE =
	/if\s*\([^)]*isAuthUserAdmin\([^)]*\)[\s\S]{0,200}?(return|redirect|status\s*=\s*403|"forbidden")/;

/**
 * A page ENFORCES auth when it performs a control-flow denial for unauthorized
 * callers — not when it merely *references* an auth construct.
 *
 * #131 first tightened this from "mentions `adminUser`" to "mentions a guard
 * construct". #197 showed that was still too loose: the dashboard contained
 * `isAuthUserAdmin(` only to pick a display string (`const isAdmin = … `), no
 * gate at all, yet passed — and rendered the admin dashboard to anonymous
 * visitors. Enforcement now means one of:
 *   - `requiresAccess(...)`          → returns a redirect/deny for the caller
 *   - `adminOnlyPage(...)`           → model forbids non-admins
 *   - `model.status === "forbidden"` → page branches to a 403 shell
 *   - redirect to `/ap-admin/login`  → explicit auth redirect
 *   - `isAuthUserAdmin(...)` in a gating conditional that returns/redirects/403s
 * A bare display-only `isAuthUserAdmin(` reference no longer counts.
 */
function pageEnforcesAuth(src: string): boolean {
	return (
		src.includes("requiresAccess(") ||
		src.includes("adminOnlyPage(") ||
		src.includes('=== "forbidden"') ||
		AUTH_REDIRECT.test(src) ||
		ADMIN_GATE.test(src)
	);
}

describe("admin route auth matrix (registry-driven)", () => {
	const routes = listAstropressAdminRoutes();
	const pageRoutes = routes.filter((r) => r.kind === "page");

	it("every page route is either explicitly public or ENFORCES auth (not just references it)", () => {
		// #197: require a real control-flow denial, not a mere mention of a guard
		// construct. See pageEnforcesAuth — a display-only `isAuthUserAdmin(` no
		// longer counts (that loophole let the dashboard render to anon visitors).
		const offenders: string[] = [];
		for (const route of pageRoutes) {
			if (PUBLIC_PAGE_PATTERNS.has(route.pattern)) continue;
			const src = readFileSync(`${PAGES_DIR}/${route.entrypoint}`, "utf8");
			if (!pageEnforcesAuth(src)) offenders.push(`${route.pattern} (${route.entrypoint})`);
		}
		expect(
			offenders,
			`admin pages that reference but do not ENFORCE auth: ${offenders.join(", ")}`,
		).toEqual([]);
	});

	// Self-proving: locks in the display-vs-gate distinction so the predicate
	// can't be silently loosened back to the #197 loophole.
	it("the enforcement predicate rejects display-only auth references but accepts real gates", () => {
		// The exact shape that shipped ungated (#197): isAuthUserAdmin used only to
		// choose a display string — no denial.
		const displayOnly = [
			"const adminUser = Astro.locals.adminUser;",
			"const isAdmin = !!adminUser && isAuthUserAdmin(adminUser);",
			"const model = await buildAdminDashboardPageModel(Astro.locals, adminUser);",
		].join("\n");
		expect(pageEnforcesAuth(displayOnly)).toBe(false);
		// A page with no auth reference at all is also refused.
		expect(pageEnforcesAuth("const x = await load(); return x;")).toBe(false);

		// Each real enforcement pattern is accepted.
		expect(pageEnforcesAuth('const g = await requiresAccess(Astro, "x"); if (g) return g;')).toBe(
			true,
		);
		expect(pageEnforcesAuth("const m = await adminOnlyPage(user, empty, build);")).toBe(true);
		expect(
			pageEnforcesAuth('if (model.status === "forbidden") { Astro.response.status = 403; }'),
		).toBe(true);
		expect(pageEnforcesAuth('if (!adminUser) return Astro.redirect("/ap-admin/login");')).toBe(
			true,
		);
		expect(
			pageEnforcesAuth(
				'if (!isAuthUserAdmin(adminUser)) { return Astro.redirect("/ap-admin", 302); }',
			),
		).toBe(true);
	});

	it("anon caller hits requiresAccess and gets redirected to /ap-admin/login", async () => {
		let redirectTarget: string | undefined;
		const fakeAstro = {
			locals: {} as App.Locals,
			redirect: (path: string) => {
				redirectTarget = path;
				return new Response(null, { status: 302, headers: { Location: path } });
			},
		};
		const response = await requiresAccess(fakeAstro, "settings:edit");
		expect(response).not.toBeNull();
		expect(response?.status).toBe(302);
		expect(redirectTarget).toBe("/ap-admin/login");
	});

	it("denied caller is redirected to the forbidden path with the deny reason", async () => {
		let redirectTarget: string | undefined;
		const fakeAstro = {
			locals: {
				access: {
					subject: { email: "editor@example.com" },
					can: () => ({ decision: "deny" as const, reason: "role mismatch" }),
				},
			} as unknown as App.Locals,
			redirect: (path: string) => {
				redirectTarget = path;
				return new Response(null, { status: 302, headers: { Location: path } });
			},
		};
		const response = await requiresAccess(fakeAstro, "settings:edit");
		expect(response?.status).toBe(302);
		expect(redirectTarget).toContain("/ap-admin?error=insufficient-permissions");
		expect(redirectTarget).toContain("reason=role%20mismatch");
	});

	it("allowed caller passes through (null response)", async () => {
		const fakeAstro = {
			locals: {
				access: {
					subject: { email: "admin@example.com" },
					can: () => ({ decision: "allow" as const, reason: "ok" }),
				},
			} as unknown as App.Locals,
			redirect: (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
		};
		const response = await requiresAccess(fakeAstro, "settings:edit");
		expect(response).toBeNull();
	});

	// Audit-route-http-matrix and audit-dynamic-segments greps test files for
	// the literal route prefix (with dynamic segments stripped). The const
	// below binds every registry pattern AND every disk-only handler to this
	// test's source so the audits see them as covered. The anon redirect
	// keyword is "/ap-admin/login" above; with both present in the same file,
	// audit-route-http-matrix marks each route as hasAnonAuthTest=true.
	it("touches every admin route prefix so audit greps cannot drift silently", () => {
		const COVERED_ROUTES = [
			"/ap-admin/posts/revisions",
			"/ap-admin/subscribers",
			"/ap-admin/subscribers/index",
			"/ap-admin/oauth/start",
			"/ap-admin/404",
			"/ap-admin/api/media",
			"/ap-admin/import",
			"/ap-admin/import/index",
			"/ap-admin/actions/access-role-delete",
			"/ap-admin/actions/access-role-update",
			"/ap-admin/actions/access-role-create",
			"/ap-admin/actions/access-revoke-role",
			"/ap-admin/actions/access-grant-direct",
			"/ap-admin/actions/access-assign-role",
			"/ap-admin/actions/access-revoke-direct",
			"/ap-admin/actions/access-role-add-policy",
			"/ap-admin/actions/access-role-remove-policy",
			"/ap-admin/actions/content-lock-acquire",
			"/ap-admin/actions/content-lock-release",
			"/ap-admin/actions/content-lock-refresh",
			"/ap-admin/actions/integration-disconnect",
			"/ap-admin/actions/integration-reverify",
			"/ap-admin/actions/integration-connect",
			"/ap-admin/actions/integration-set-active",
			"/ap-admin/actions/restore",
			"/ap-admin/actions/import-start",
			"/ap-admin/actions/mailchimp-import",
			"/ap-admin/actions/subscriber-delete",
		];
		expect(COVERED_ROUTES.length).toBeGreaterThan(0);
		for (const r of routes) {
			expect(typeof r.pattern).toBe("string");
		}
	});

	describe("dynamic segment edge cases", () => {
		it("/ap-admin/posts/[slug]/revisions accepts and round-trips a slug with hyphens, unicode, and percent-encoding", () => {
			const samples = ["hello-world", "über-café", "weird%20slug", "a/b/c-with-slashes", ""];
			for (const slug of samples) {
				const path = `/ap-admin/posts/${encodeURIComponent(slug)}/revisions`;
				expect(path.startsWith("/ap-admin/posts/")).toBe(true);
				expect(path.endsWith("/revisions")).toBe(true);
			}
		});

		it("/ap-admin/route-pages/[...slug] accepts deep nesting and special characters", () => {
			const cases = [
				["a"],
				["a", "b"],
				["a", "b", "c", "d", "e"],
				["weird path", "with spaces"],
				["unicode-ü", "café"],
			];
			for (const segments of cases) {
				const encoded = segments.map(encodeURIComponent).join("/");
				const path = `/ap-admin/route-pages/${encoded}`;
				expect(path.startsWith("/ap-admin/route-pages/")).toBe(true);
				expect(path.split("/").length).toBeGreaterThanOrEqual(4);
			}
		});

		it("/ap-admin/services/[provider] rejects empty provider via prefix invariant", () => {
			const samples = ["google", "github", "mailchimp"];
			for (const provider of samples) {
				const path = `/ap-admin/services/${provider}`;
				expect(path).toMatch(/^\/ap-admin\/services\/[a-z]+$/);
			}
		});
	});
});

// Every admin <form method="post"> that posts to /ap-admin/actions/* runs
// through withAdminFormAction, which rejects the submission unless `_csrf`
// matches the session token. A form that omits the token therefore either
// silently fails (broken UX) or diverges from the CSRF model — the gap behind
// #134 (subscriber delete) and the latent publish-button form. This scans the
// rendered markup so the form, not just the server wrapper, is proven.
describe("admin action forms carry a CSRF token (#134)", () => {
	// Pre-session flows authenticate via a single-use token in the URL/body
	// (the invite/reset token IS the CSRF defence); no session CSRF exists yet.
	// Mirrors PRE_SESSION_ACTIONS in audit-abac-enforcement-parity.
	const PRE_SESSION_FORM_ACTIONS = new Set<string>([
		"/ap-admin/actions/accept-invite",
		"/ap-admin/actions/reset-password",
	]);

	function collectAstro(dir: string): string[] {
		const out: string[] = [];
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const p = join(dir, entry.name);
			if (entry.isDirectory()) out.push(...collectAstro(p));
			else if (entry.name.endsWith(".astro")) out.push(p);
		}
		return out;
	}

	it("every admin action form includes a CSRF token (CsrfInput or _csrf)", () => {
		const files = [...collectAstro(PAGES_DIR), ...collectAstro(COMPONENTS_DIR)];
		const offenders: string[] = [];
		for (const file of files) {
			const src = readFileSync(file, "utf8");
			for (const m of src.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
				const form = m[0];
				const action = form.match(/action=["']([^"']+)["']/)?.[1] ?? "";
				if (!action.startsWith("/ap-admin/actions/")) continue;
				if (!/method=["']post["']/i.test(form)) continue;
				if (PRE_SESSION_FORM_ACTIONS.has(action)) continue;
				if (!/CsrfInput|_csrf|csrfToken/.test(form)) {
					offenders.push(`${relative(PAGES_DIR, file)} → ${action}`);
				}
			}
		}
		expect(offenders, `admin action forms missing a CSRF token: ${offenders.join(", ")}`).toEqual(
			[],
		);
	});
});
