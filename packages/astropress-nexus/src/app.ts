import { Hono } from "hono";
import { discoverCloudwaySites } from "./connectors/cloudways.js";
import { discoverCPanelWordPressSites } from "./connectors/cpanel.js";
import { discoverHPanelSites } from "./connectors/hpanel.js";
import { createJob, getJob, listJobs, updateJob } from "./jobs.js";
import { getAggregateMetrics } from "./metrics-cache.js";
import { SiteRegistry } from "./registry.js";
import {
	checkSiteHealth,
	postSiteRequest,
	proxySiteRequest,
} from "./site-client.js";
import type {
	ContentItem,
	FanOutResult,
	NexusConfig,
	SiteEntry,
	SiteHealth,
} from "./types.js";

export type NexusAppOptions = {
	config: NexusConfig;
	/** Org-level bearer token required on all protected routes. If omitted, auth is disabled. */
	authToken?: string;
};

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function getRequestedToken(request: Request) {
	const authorization = request.headers.get("Authorization");
	if (authorization?.startsWith("Bearer ")) {
		return authorization.slice(7);
	}

	const url = new URL(request.url);
	return url.searchParams.get("token");
}

async function getSiteStatuses(sites: SiteEntry[]) {
	const healthChecks = await Promise.allSettled(
		sites.map((site) => checkSiteHealth(site)),
	);
	return healthChecks.map((result, index): SiteHealth => {
		if (result.status === "fulfilled") {
			return result.value;
		}

		const site = sites[index];
		return {
			id: site.id,
			name: site.name,
			baseUrl: site.baseUrl,
			status: "degraded",
			error: "check failed",
		};
	});
}

function normalizeRedirectTarget(value: string | undefined, fallback: string) {
	if (!value || !value.startsWith("/")) {
		return fallback;
	}
	return value;
}

function collectSelectedSiteIds(
	formData: Record<string, string | File | (string | File)[]>,
) {
	const raw = formData.siteIds ?? formData.siteId;
	const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
	return values
		.map((entry) => String(entry).trim())
		.filter((entry) => entry.length > 0);
}

function renderDashboardHtml(input: {
	title: string;
	authToken?: string;
	query: string;
	refreshed?: string | null;
	redeployed?: string | null;
	sites: SiteEntry[];
	statuses: SiteHealth[];
	metrics: Awaited<ReturnType<typeof getAggregateMetrics>>;
}) {
	const {
		title,
		authToken,
		query,
		refreshed,
		redeployed,
		sites,
		statuses,
		metrics,
	} = input;
	const filtered = sites.filter((site) => {
		const haystack =
			`${site.name} ${site.id} ${site.baseUrl} ${site.description ?? ""}`.toLowerCase();
		return haystack.includes(query.toLowerCase());
	});
	const statusMap = new Map(statuses.map((status) => [status.id, status]));
	const tokenSuffix = authToken
		? `?token=${encodeURIComponent(authToken)}`
		: "";

	const cards = filtered
		.map((site) => {
			const status = statusMap.get(site.id);
			const metric = metrics.sites.find((entry) => entry.id === site.id);
			const adminLink = site.adminUrl ?? `${site.baseUrl}/ap-admin`;
			const detailHref = `/dashboard/sites/${encodeURIComponent(site.id)}${tokenSuffix}`;
			const redeployDisabled = site.deployHookUrl ? "" : "disabled";
			const statusTone = status?.status === "ok" ? "ok" : "degraded";

			return `
      <article class="site-card">
        <div class="site-card__header">
          <div>
            <p class="eyebrow">${escapeHtml(site.id)}</p>
            <h2><a href="${detailHref}">${escapeHtml(site.name)}</a></h2> <!-- audit-ok: detailHref built from encodeURIComponent(site.id) — not raw user input -->
          </div>
          <span class="pill pill--${statusTone}">${escapeHtml(status?.status ?? "unknown")}</span>
        </div>
        <p class="site-card__url"><a href="${escapeHtml(site.baseUrl)}">${escapeHtml(site.baseUrl)}</a></p>
        <p class="site-card__body">${escapeHtml(site.description ?? "No operator notes yet.")}</p>
        <dl class="site-metrics">
          <div><dt>Posts</dt><dd>${metric?.posts ?? 0}</dd></div>
          <div><dt>Pages</dt><dd>${metric?.pages ?? 0}</dd></div>
          <div><dt>Media</dt><dd>${metric?.media ?? 0}</dd></div>
          <div><dt>Latency</dt><dd>${status?.latencyMs ?? "—"}</dd></div>
        </dl>
        ${status?.error ? `<p class="error-text">${escapeHtml(status.error)}</p>` : ""}
        <div class="site-card__actions">
          <a class="button button--secondary" href="${escapeHtml(adminLink)}">Open admin</a>
          <form method="post" action="/actions/redeploy${tokenSuffix}">
            <input type="hidden" name="siteId" value="${escapeHtml(site.id)}" />
            <input type="hidden" name="redirectTo" value="/dashboard${tokenSuffix}" />
            <button class="button" type="submit" ${redeployDisabled}>Redeploy</button>
          </form>
        </div>
      </article>
    `;
		})
		.join("");

	return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        :root { color-scheme: light; --bg:#f4efe8; --ink:#1f1c18; --card:#fffdf9; --line:#d9ccbb; --accent:#00594c; --warn:#8a3b12; --ok:#1c6b48; }
        * { box-sizing:border-box; }
        body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif; color:var(--ink); background:linear-gradient(180deg,#efe4d4 0%,#f9f5ee 100%); }
        a { color:inherit; }
        .shell { max-width:1200px; margin:0 auto; padding:24px 16px 48px; }
        .topbar, .summary, .bulk-bar, .site-grid { display:grid; gap:16px; }
        .topbar { grid-template-columns: 1.4fr 1fr; align-items:end; margin-bottom:24px; }
        .topbar h1 { margin:4px 0 0; font-size:clamp(2rem,4vw,3.75rem); line-height:0.95; }
        .eyebrow { margin:0; text-transform:uppercase; letter-spacing:.12em; font-size:.75rem; opacity:.72; }
        .surface { background:rgba(255,253,249,.86); border:1px solid var(--line); border-radius:20px; padding:18px; backdrop-filter: blur(8px); }
        .summary { grid-template-columns: repeat(4,minmax(0,1fr)); margin-bottom:16px; }
        .summary strong { display:block; font-size:2rem; }
        .bulk-bar { grid-template-columns: 1fr auto; align-items:center; margin-bottom:16px; }
        .site-grid { grid-template-columns: repeat(auto-fit,minmax(280px,1fr)); }
        .site-card { background:var(--card); border:1px solid var(--line); border-radius:20px; padding:18px; box-shadow:0 14px 40px rgba(34,28,20,.06); }
        .site-card__header, .site-card__actions { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
        .site-card__url { font-family: ui-monospace, monospace; font-size:.82rem; overflow-wrap:anywhere; }
        .site-card__body { min-height:2.8rem; }
        .site-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin:14px 0; }
        .site-metrics div, .summary .surface { background:#fff; border-radius:14px; padding:12px; border:1px solid var(--line); }
        dt { font-size:.75rem; text-transform:uppercase; letter-spacing:.08em; opacity:.72; }
        dd { margin:4px 0 0; font-size:1.2rem; font-weight:700; }
        .pill { display:inline-flex; padding:6px 10px; border-radius:999px; font-size:.8rem; text-transform:capitalize; }
        .pill--ok { background:#ddf4e7; color:var(--ok); }
        .pill--degraded { background:#fde7df; color:var(--warn); }
        .button { appearance:none; border:none; border-radius:999px; background:var(--accent); color:#fff; padding:10px 14px; cursor:pointer; text-decoration:none; }
        .button--secondary { background:#fff; color:var(--ink); border:1px solid var(--line); }
        .button[disabled] { cursor:not-allowed; opacity:.45; }
        .flash { margin-bottom:16px; }
        .error-text { color:var(--warn); font-size:.92rem; }
        form.inline { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        input[type="search"] { width:100%; padding:12px 14px; border-radius:999px; border:1px solid var(--line); background:#fff; }
        @media (max-width: 768px) {
          .topbar, .summary, .bulk-bar { grid-template-columns:1fr; }
          .site-card__header, .site-card__actions { flex-direction:column; }
          .button, input[type="search"] { width:100%; }
        }
      </style>
    </head>
    <body>
      <main class="shell">
        <p class="eyebrow">Nexus / Dashboard</p>
        <section class="topbar">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <p>Operate multiple Astropress sites from one control plane. Search, inspect, refresh, and redeploy from a single page.</p>
          </div>
          <form class="surface inline" method="get" action="/dashboard">
            ${authToken ? `<input type="hidden" name="token" value="${escapeHtml(authToken)}" />` : ""}
            <label style="flex:1">
              <span class="eyebrow">Filter sites</span>
              <input type="search" name="q" value="${escapeHtml(query)}" placeholder="Search by name, id, domain, or note" />
            </label>
            <button class="button" type="submit">Apply</button>
          </form>
        </section>
        ${refreshed ? `<div class="surface flash">Refreshed ${escapeHtml(refreshed)} site health checks.</div>` : ""}
        ${redeployed ? `<div class="surface flash">Triggered redeploy for ${escapeHtml(redeployed)} site(s).</div>` : ""}
        <section class="summary">
          <div class="surface"><p class="eyebrow">Sites</p><strong>${metrics.siteCount}</strong></div>
          <div class="surface"><p class="eyebrow">Reachable</p><strong>${metrics.reachableSites}</strong></div>
          <div class="surface"><p class="eyebrow">Degraded</p><strong>${metrics.degradedSites}</strong></div>
          <div class="surface"><p class="eyebrow">Content</p><strong>${metrics.totalPosts + metrics.totalPages}</strong></div>
        </section>
        <section class="surface bulk-bar">
          <div>
            <p class="eyebrow">Bulk actions</p>
            <p>Select the sites you want to touch, then refresh health or trigger deploy hooks.</p>
          </div>
          <form class="inline" method="post" action="/actions/refresh${tokenSuffix}">
            ${filtered.map((site) => `<label><input type="checkbox" name="siteIds" value="${escapeHtml(site.id)}" /> ${escapeHtml(site.name)}</label>`).join("")}
            <input type="hidden" name="redirectTo" value="/dashboard${tokenSuffix}" />
            <button class="button button--secondary" type="submit">Refresh</button>
          </form>
        </section>
        <section class="site-grid">${cards || `<div class="surface">No sites matched "${escapeHtml(query)}".</div>`}</section>
      </main>
    </body>
  </html>`;
}

function renderSiteDetailHtml(input: {
	title: string;
	authToken?: string;
	site: SiteEntry;
	health: SiteHealth;
	jobs: ReturnType<typeof listJobs>;
}) {
	const { title, authToken, site, health, jobs } = input;
	const tokenSuffix = authToken
		? `?token=${encodeURIComponent(authToken)}`
		: "";
	const adminLink = site.adminUrl ?? `${site.baseUrl}/ap-admin`;

	return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(site.name)} | ${escapeHtml(title)}</title>
      <style>
        body { margin:0; font-family:ui-sans-serif, system-ui, sans-serif; background:#f6f1e7; color:#201d19; }
        main { max-width:960px; margin:0 auto; padding:24px 16px 48px; }
        .surface { background:#fffdf9; border:1px solid #dbcdbd; border-radius:20px; padding:18px; margin-bottom:16px; }
        .breadcrumbs { font-size:.92rem; margin-bottom:12px; }
        .pill { display:inline-flex; padding:6px 10px; border-radius:999px; background:${health.status === "ok" ? "#ddf4e7" : "#fde7df"}; color:${health.status === "ok" ? "#1c6b48" : "#8a3b12"}; }
        .actions { display:flex; gap:12px; flex-wrap:wrap; margin-top:16px; }
        .button { appearance:none; border:none; border-radius:999px; background:#00594c; color:#fff; padding:10px 14px; text-decoration:none; }
        .button--secondary { background:#fff; color:#201d19; border:1px solid #dbcdbd; }
        code { font-family:ui-monospace, monospace; }
      </style>
    </head>
    <body>
      <main>
        <p class="breadcrumbs"><a href="/dashboard${tokenSuffix}">Dashboard</a> / <strong>${escapeHtml(site.name)}</strong></p>
        <section class="surface">
          <p>${escapeHtml(site.id)}</p>
          <h1>${escapeHtml(site.name)}</h1>
          <p><span class="pill">${escapeHtml(health.status)}</span></p>
          <p><strong>Base URL:</strong> <a href="${escapeHtml(site.baseUrl)}">${escapeHtml(site.baseUrl)}</a></p>
          <p><strong>Admin URL:</strong> <a href="${escapeHtml(adminLink)}">${escapeHtml(adminLink)}</a></p>
          <p><strong>Latency:</strong> ${health.latencyMs ?? "—"} ms</p>
          ${health.error ? `<p><strong>Error:</strong> ${escapeHtml(health.error)}</p>` : ""}
          <p>${escapeHtml(site.description ?? "No operator notes configured.")}</p>
          <div class="actions">
            <a class="button button--secondary" href="${escapeHtml(adminLink)}">Open admin</a>
            <form method="post" action="/actions/redeploy${tokenSuffix}">
              <input type="hidden" name="siteId" value="${escapeHtml(site.id)}" />
              <input type="hidden" name="redirectTo" value="/dashboard/sites/${encodeURIComponent(site.id)}${tokenSuffix}" />
              <button class="button" type="submit" ${site.deployHookUrl ? "" : "disabled"}>Redeploy</button>
            </form>
          </div>
        </section>
        <section class="surface">
          <h2>Recent jobs</h2>
          <ul>
            ${
							jobs.jobs
								.filter((job) => job.siteId === site.id)
								.slice(0, 5)
								.map(
									(job) =>
										`<li><code>${escapeHtml(job.kind)}</code> — ${escapeHtml(job.status)} (${escapeHtml(job.id)})</li>`,
								)
								.join("") || "<li>No jobs recorded yet.</li>"
						}
          </ul>
        </section>
      </main>
    </body>
  </html>`;
}

export function createNexusApp(options: NexusAppOptions): Hono {
	const { config, authToken } = options;
	const registry = new SiteRegistry(config);
	const app = new Hono();

	// ── Auth middleware (applied to all routes except GET /) ──────────────────
	app.use("/*", async (c, next) => {
		// Health check is public
		if (c.req.method === "GET" && (c.req.path === "/" || c.req.path === "")) {
			return next();
		}

		if (!authToken) {
			return next();
		}

		const token = getRequestedToken(c.req.raw);

		if (!token || token !== authToken) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		return next();
	});

	// ── GET / — public health check ───────────────────────────────────────────
	app.get("/", async (c) => {
		const sites = registry.getAll();
		const siteStatuses = await getSiteStatuses(sites);

		const allOk = siteStatuses.every((s) => s.status === "ok");
		return c.json({
			status: allOk ? "ok" : "degraded",
			siteCount: sites.length,
			sites: siteStatuses,
		});
	});

	app.get("/dashboard", async (c) => {
		const sites = registry.getAll();
		const statuses = await getSiteStatuses(sites);
		const metrics = await getAggregateMetrics(sites);
		const url = new URL(c.req.url);
		const query = (url.searchParams.get("q") ?? "").trim();
		const html = renderDashboardHtml({
			title: config.dashboardTitle ?? "Astropress Nexus",
			authToken: getRequestedToken(c.req.raw) ?? undefined,
			query,
			refreshed: url.searchParams.get("refreshed"),
			redeployed: url.searchParams.get("redeployed"),
			sites,
			statuses,
			metrics,
		});
		return c.html(html);
	});

	app.get("/dashboard/sites/:id", async (c) => {
		const site = registry.get(c.req.param("id"));
		if (!site) {
			return c.json({ error: `Site '${c.req.param("id")}' not found` }, 404);
		}
		const health = await checkSiteHealth(site);
		const html = renderSiteDetailHtml({
			title: config.dashboardTitle ?? "Astropress Nexus",
			authToken: getRequestedToken(c.req.raw) ?? undefined,
			site,
			health,
			jobs: listJobs(20, 0),
		});
		return c.html(html);
	});

	// ── GET /sites — list all sites with health ───────────────────────────────
	app.get("/sites", async (c) => {
		const sites = registry.getAll();
		return c.json(await getSiteStatuses(sites));
	});

	// ── GET /sites/:id — single site metadata + health ────────────────────────
	app.get("/sites/:id", async (c) => {
		const id = c.req.param("id");
		const site = registry.get(id);
		if (!site) {
			return c.json({ error: `Site '${id}' not found` }, 404);
		}
		const health = await checkSiteHealth(site);
		return c.json(health);
	});

	// ── GET /sites/:id/content — proxy to member site content ────────────────
	app.get("/sites/:id/content", async (c) => {
		const id = c.req.param("id");
		const site = registry.get(id);
		if (!site) {
			return c.json({ error: `Site '${id}' not found` }, 404);
		}
		const url = new URL(c.req.url);
		const result = await proxySiteRequest(site, "content", url.searchParams);
		return c.json(result.body, result.status as 200 | 502);
	});

	// ── GET /sites/:id/content/:slug — proxy single record ───────────────────
	app.get("/sites/:id/content/:slug", async (c) => {
		const id = c.req.param("id");
		const slug = c.req.param("slug");
		const site = registry.get(id);
		if (!site) {
			return c.json({ error: `Site '${id}' not found` }, 404);
		}
		const result = await proxySiteRequest(
			site,
			`content/${encodeURIComponent(slug)}`,
		);
		return c.json(result.body, result.status as 200 | 404 | 502);
	});

	// ── GET /sites/:id/media — proxy to member site media ────────────────────
	app.get("/sites/:id/media", async (c) => {
		const id = c.req.param("id");
		const site = registry.get(id);
		if (!site) {
			return c.json({ error: `Site '${id}' not found` }, 404);
		}
		const url = new URL(c.req.url);
		const result = await proxySiteRequest(site, "media", url.searchParams);
		return c.json(result.body, result.status as 200 | 502);
	});

	// ── GET /sites/:id/settings — proxy to member site settings ──────────────
	app.get("/sites/:id/settings", async (c) => {
		const id = c.req.param("id");
		const site = registry.get(id);
		if (!site) {
			return c.json({ error: `Site '${id}' not found` }, 404);
		}
		const result = await proxySiteRequest(site, "settings");
		return c.json(result.body, result.status as 200 | 502);
	});

	// ── GET /content — fan-out across all sites ───────────────────────────────
	app.get("/content", async (c) => {
		const sites = registry.getAll();
		const url = new URL(c.req.url);

		const results = await Promise.allSettled(
			sites.map(async (site): Promise<FanOutResult<ContentItem[]>> => {
				const result = await proxySiteRequest(
					site,
					"content",
					url.searchParams,
				);
				if (!result.ok) {
					return {
						siteId: site.id,
						status: "degraded",
						error: String(
							(result.body as Record<string, unknown>).error ??
								"request failed",
						),
					};
				}
				const items = (
					Array.isArray(result.body)
						? result.body
						: ((result.body as Record<string, unknown>).items ?? [])
				) as ContentItem[];
				const tagged = items.map((item) => ({ ...item, siteId: site.id }));
				return { siteId: site.id, status: "ok", data: tagged };
			}),
		);

		const items: ContentItem[] = [];
		const degraded: Array<{ siteId: string; error: string }> = [];

		for (const r of results) {
			if (r.status === "fulfilled") {
				if (r.value.status === "ok" && r.value.data) {
					items.push(...r.value.data);
				} else {
					degraded.push({
						siteId: r.value.siteId,
						error: r.value.error ?? "unknown",
					});
				}
			}
		}

		return c.json({ items, degraded, total: items.length });
	});

	// ── GET /metrics — cached aggregate metrics ───────────────────────────────
	app.get("/metrics", async (c) => {
		const sites = registry.getAll();
		const metrics = await getAggregateMetrics(sites);
		return c.json(metrics);
	});

	// ── POST /jobs/import/wordpress — queue async import on a member site ─────
	app.post("/jobs/import/wordpress", async (c) => {
		let body: Record<string, unknown>;
		try {
			body = (await c.req.json()) as Record<string, unknown>;
		} catch {
			return c.json({ error: "Request body must be valid JSON." }, 422);
		}

		const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
		const exportFile =
			typeof body.exportFile === "string" ? body.exportFile.trim() : "";

		if (!siteId) return c.json({ error: "siteId is required." }, 422);
		if (!exportFile) return c.json({ error: "exportFile is required." }, 422);

		const site = registry.get(siteId);
		if (!site) return c.json({ error: `Site '${siteId}' not found` }, 404);

		const job = createJob(siteId, "import:wordpress");

		// Fire and forget — update job status as import runs in background
		void (async () => {
			updateJob(job.id, {
				status: "running",
				startedAt: new Date().toISOString(),
			});
			const result = await postSiteRequest(site, "import/wordpress", {
				exportFile,
			});
			if (result.ok) {
				updateJob(job.id, {
					status: "completed",
					completedAt: new Date().toISOString(),
					result: result.body,
				});
			} else {
				updateJob(job.id, {
					status: "failed",
					completedAt: new Date().toISOString(),
					error: String(
						(result.body as Record<string, unknown>).error ?? "import failed",
					),
				});
			}
		})();

		return c.json({ jobId: job.id, status: "queued" }, 202);
	});

	// ── GET /jobs — list all jobs ─────────────────────────────────────────────
	app.get("/jobs", (c) => {
		const url = new URL(c.req.url);
		const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);
		const offset = Number(url.searchParams.get("offset") ?? "0");
		return c.json(listJobs(limit, offset));
	});

	// ── GET /jobs/:id — poll job status ──────────────────────────────────────
	app.get("/jobs/:id", (c) => {
		const job = getJob(c.req.param("id"));
		if (!job) return c.json({ error: "Job not found" }, 404);
		return c.json(job);
	});

	app.post("/actions/refresh", async (c) => {
		const formData = await c.req.parseBody();
		const requestedIds = collectSelectedSiteIds(formData);
		const selectedSites = (
			requestedIds.length > 0
				? requestedIds
				: registry.getAll().map((site) => site.id)
		)
			.map((id) => registry.get(id))
			.filter((site): site is SiteEntry => Boolean(site));

		await Promise.all(selectedSites.map((site) => checkSiteHealth(site)));

		const redirectTo = normalizeRedirectTarget(
			typeof formData.redirectTo === "string" ? formData.redirectTo : undefined,
			"/dashboard",
		);
		const redirectUrl = new URL(redirectTo, "http://localhost");
		redirectUrl.searchParams.set("refreshed", String(selectedSites.length));
		const token = getRequestedToken(c.req.raw);
		if (token) {
			redirectUrl.searchParams.set("token", token);
		}
		return c.redirect(`${redirectUrl.pathname}${redirectUrl.search}`);
	});

	app.post("/actions/redeploy", async (c) => {
		const formData = await c.req.parseBody();
		const requestedIds = collectSelectedSiteIds(formData);
		const selectedSites = (
			requestedIds.length > 0
				? requestedIds
				: registry.getAll().map((site) => site.id)
		)
			.map((id) => registry.get(id))
			.filter((site): site is SiteEntry => Boolean(site));

		const deployableSites = selectedSites.filter((site) => site.deployHookUrl);
		await Promise.allSettled(
			deployableSites.map((site) =>
				fetch(site.deployHookUrl as string, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						siteId: site.id,
						source: "@astropress-diy/nexus",
					}),
				}),
			),
		);

		const redirectTo = normalizeRedirectTarget(
			typeof formData.redirectTo === "string" ? formData.redirectTo : undefined,
			"/dashboard",
		);
		const redirectUrl = new URL(redirectTo, "http://localhost");
		redirectUrl.searchParams.set("redeployed", String(deployableSites.length));
		const token = getRequestedToken(c.req.raw);
		if (token) {
			redirectUrl.searchParams.set("token", token);
		}
		return c.redirect(`${redirectUrl.pathname}${redirectUrl.search}`);
	});

	// ── POST /connectors/cloudways/discover ───────────────────────────────────
	app.post("/connectors/cloudways/discover", async (c) => {
		let body: Record<string, unknown>;
		try {
			body = (await c.req.json()) as Record<string, unknown>;
		} catch {
			return c.json({ error: "Request body must be valid JSON." }, 422);
		}

		const email = typeof body.email === "string" ? body.email.trim() : "";
		const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

		if (!email) return c.json({ error: "email is required." }, 422);
		if (!apiKey) return c.json({ error: "apiKey is required." }, 422);

		try {
			const sites = await discoverCloudwaySites({ email, apiKey });
			return c.json({ sites });
		} catch (err) {
			return c.json(
				{
					error:
						err instanceof Error ? err.message : "Cloudways discovery failed.",
				},
				502,
			);
		}
	});

	// ── POST /connectors/cpanel/discover ─────────────────────────────────────
	app.post("/connectors/cpanel/discover", async (c) => {
		let body: Record<string, unknown>;
		try {
			body = (await c.req.json()) as Record<string, unknown>;
		} catch {
			return c.json({ error: "Request body must be valid JSON." }, 422);
		}

		const host = typeof body.host === "string" ? body.host.trim() : "";
		const username =
			typeof body.username === "string" ? body.username.trim() : "";
		const password = typeof body.password === "string" ? body.password : "";

		if (!host) return c.json({ error: "host is required." }, 422);
		if (!username) return c.json({ error: "username is required." }, 422);
		if (!password) return c.json({ error: "password is required." }, 422);

		try {
			const sites = await discoverCPanelWordPressSites({
				host,
				username,
				password,
			});
			return c.json({ sites });
		} catch (err) {
			return c.json(
				{
					error:
						err instanceof Error ? err.message : "cPanel discovery failed.",
				},
				502,
			);
		}
	});

	// ── POST /connectors/hpanel/discover ─────────────────────────────────────
	app.post("/connectors/hpanel/discover", async (c) => {
		let body: Record<string, unknown>;
		try {
			body = (await c.req.json()) as Record<string, unknown>;
		} catch {
			return c.json({ error: "Request body must be valid JSON." }, 422);
		}

		const accessToken =
			typeof body.accessToken === "string" ? body.accessToken.trim() : "";
		if (!accessToken) return c.json({ error: "accessToken is required." }, 422);

		try {
			const sites = await discoverHPanelSites({ accessToken });
			return c.json({ sites });
		} catch (err) {
			return c.json(
				{
					error:
						err instanceof Error ? err.message : "hPanel discovery failed.",
				},
				502,
			);
		}
	});

	return app;
}
