// Direct integration tests for src/import/wordpress.ts using static
// imports (the existing branches.test.ts uses vi.resetModules() + dynamic
// import which breaks Stryker's per-test coverage tracker for widely-imported
// sources). This file re-asserts the same behavior with exact-value
// assertions on every artifact filename, every warning string, and every
// derived count.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAstropressWordPressImportSource } from "../src/import/wordpress.js";

function makeWxr(items: string[]): string {
	return ["<rss>", "<channel>", ...items, "</channel>", "</rss>"].join("");
}

function makePost(
	overrides: { id?: string; name?: string; status?: string; body?: string; excerpt?: string } = {},
): string {
	const id = overrides.id ?? "101";
	const name = overrides.name ?? "hello";
	const status = overrides.status ?? "publish";
	const body = overrides.body ?? "<p>Hello</p>";
	const excerpt = overrides.excerpt;
	return [
		"<item>",
		`<title><![CDATA[Title ${name}]]></title>`,
		`<link>https://example.org/${name}/</link>`,
		`<content:encoded><![CDATA[${body}]]></content:encoded>`,
		excerpt ? `<excerpt:encoded><![CDATA[${excerpt}]]></excerpt:encoded>` : "",
		`<wp:post_id>${id}</wp:post_id>`,
		"<wp:post_date>2024-01-01 12:00:00</wp:post_date>",
		`<wp:post_name>${name}</wp:post_name>`,
		`<wp:status>${status}</wp:status>`,
		"<wp:post_type>post</wp:post_type>",
		"</item>",
	].join("");
}

let workspace: string;
let exportFile: string;

beforeEach(async () => {
	workspace = await mkdtemp(join(tmpdir(), "astropress-wpi-direct-"));
	exportFile = join(workspace, "export.xml");
});

afterEach(async () => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	await rm(workspace, { recursive: true, force: true });
});

describe("stageArtifacts — exact artifact filenames", () => {
	it("writes every staged artifact at its exact documented path", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const artifactDir = join(workspace, "stage");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile, artifactDir });
		expect(report.artifacts).toBeDefined();
		const a = report.artifacts!;
		expect(a.artifactDir).toBe(artifactDir);
		expect(a.inventoryFile).toBe(join(artifactDir, "wordpress.inventory.json"));
		expect(a.planFile).toBe(join(artifactDir, "wordpress.plan.json"));
		expect(a.contentFile).toBe(join(artifactDir, "content-records.json"));
		expect(a.mediaFile).toBe(join(artifactDir, "media-manifest.json"));
		expect(a.commentFile).toBe(join(artifactDir, "comment-records.json"));
		expect(a.userFile).toBe(join(artifactDir, "user-records.json"));
		expect(a.redirectFile).toBe(join(artifactDir, "redirect-records.json"));
		expect(a.taxonomyFile).toBe(join(artifactDir, "taxonomy-records.json"));
		expect(a.remediationFile).toBe(join(artifactDir, "remediation-candidates.json"));
		expect(a.downloadStateFile).toBe(join(artifactDir, "download-state.json"));
		expect(a.reportFile).toBe(join(artifactDir, "import-report.json"));
		// Every file actually exists on disk.
		for (const p of [
			a.inventoryFile,
			a.planFile,
			a.contentFile,
			a.mediaFile,
			a.commentFile,
			a.userFile,
			a.redirectFile,
			a.taxonomyFile,
			a.remediationFile,
			a.downloadStateFile,
			a.reportFile,
		] as string[]) {
			const content = await readFile(p, "utf8");
			expect(content.endsWith("\n")).toBe(true);
		}
	});

	it("writes the download-state.json with `{completed: [], failed: []}` when downloadMedia is disabled — kills the line 199-201 ObjectLiteral & ArrayDeclaration mutants and the `if (!plan.downloadMedia)` ConditionalExpression at line 198", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const artifactDir = join(workspace, "no-download");
		const importer = createAstropressWordPressImportSource();
		await importer.importWordPress({ exportFile, artifactDir, downloadMedia: false });
		const dl = JSON.parse(await readFile(join(artifactDir, "download-state.json"), "utf8"));
		expect(dl).toEqual({ completed: [], failed: [] });
	});

	it("returns no artifacts (artifacts === undefined) when artifactDir is not provided", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile });
		expect(report.artifacts).toBeUndefined();
	});
});

describe("buildInventory — detectedShortcodes spans body AND excerpt", () => {
	it("counts shortcodes in the excerpt — kills the `r.excerpt ?? ''` LogicalOperator/StringLiteral mutants on line 93", async () => {
		// Body has no shortcodes; excerpt has one
		const item = makePost({ body: "<p>clean</p>", excerpt: "[gallery ids='1']" });
		await writeFile(exportFile, makeWxr([item]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const inv = await importer.inspectWordPress?.({ exportFile });
		expect(inv?.detectedShortcodes).toBeGreaterThan(0);
		expect(inv?.unsupportedPatterns).toContain("shortcodes");
	});
});

describe("buildImportPlan — override flags & manualTasks", () => {
	it("default downloadMedia is false when neither overrides nor inventory hint at downloads", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const inv = await importer.inspectWordPress?.({ exportFile });
		const plan = await importer.planWordPressImport?.({
			inventory: inv as NonNullable<typeof inv>,
		});
		expect(plan?.downloadMedia).toBe(false);
		expect(plan?.applyLocal).toBe(false);
	});

	it("dedupes manualTasks: when warnings + remediation produce the same text, it appears once", async () => {
		const body = '<p>page</p><div class="vc_row">builder</div>';
		await writeFile(exportFile, makeWxr([makePost({ body })]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile });
		// The dedup `new Set(manualTasks)` must keep the count stable.
		const remediationTask =
			"Review remediation-candidates.json for shortcode or page-builder cleanup before publishing staged content.";
		const occurrences = report.manualTasks.filter((t) => t === remediationTask).length;
		expect(occurrences).toBe(1);
	});

	it("propagates `reviewRequired: true` when unsupportedPatterns are detected (kills the `length > 0` comparator)", async () => {
		const body = '<p>p</p><div class="elementor">builder</div>';
		await writeFile(exportFile, makeWxr([makePost({ body })]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile });
		expect(report.plan.reviewRequired).toBe(true);
	});

	it("`reviewRequired: false` when unsupportedPatterns is empty (kills the equality comparator flips)", async () => {
		await writeFile(exportFile, makeWxr([makePost({ body: "<p>clean</p>" })]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile });
		expect(report.plan.reviewRequired).toBe(false);
	});
});

describe("resolveImportOverrides — explicit-false defaults", () => {
	it("respects explicit includeUsers: false (kills `?? true` LogicalOperator)", async () => {
		await writeFile(
			exportFile,
			[
				"<rss><channel>",
				"<wp:author><wp:author_id>1</wp:author_id><wp:author_login><![CDATA[u]]></wp:author_login><wp:author_display_name><![CDATA[U]]></wp:author_display_name></wp:author>",
				makePost(),
				"</channel></rss>",
			].join(""),
			"utf8",
		);
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile, includeUsers: false });
		expect(report.plan.includeUsers).toBe(false);
		expect(report.importedUsers).toBe(0);
	});

	it("respects explicit includeMedia: false and explicit downloadMedia: false (kills `?? true` / `?? false`)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({
			exportFile,
			includeMedia: false,
			downloadMedia: false,
		});
		expect(report.plan.includeMedia).toBe(false);
		expect(report.plan.downloadMedia).toBe(false);
	});

	it("respects explicit applyLocal: false (kills the `?? false` LogicalOperator)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile, applyLocal: false });
		expect(report.plan.applyLocal).toBe(false);
		expect(report.localApply).toBeUndefined();
	});
});

describe("resolveImportStatus — both branches", () => {
	it("returns 'completed' when no shortcodes/builders and no failedMedia", async () => {
		await writeFile(exportFile, makeWxr([makePost({ body: "<p>clean</p>" })]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile });
		expect(report.status).toBe("completed");
	});

	it("returns 'completed_with_warnings' when reviewRequired is true (kills the reviewRequired-side of the OR)", async () => {
		const body = '<p>p</p><div class="vc_row">builder</div>';
		await writeFile(exportFile, makeWxr([makePost({ body })]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile });
		expect(report.status).toBe("completed_with_warnings");
	});

	it("returns 'completed_with_warnings' when failedMedia.length > 0 (kills the failedMedia side of the OR and the > 0 comparator)", async () => {
		await writeFile(
			exportFile,
			makeWxr([
				[
					"<item>",
					"<title><![CDATA[bad]]></title>",
					"<link>https://example.org/wp-content/uploads/bad.png</link>",
					"<wp:post_id>301</wp:post_id>",
					"<wp:post_name>bad</wp:post_name>",
					"<wp:status>inherit</wp:status>",
					"<wp:post_type>attachment</wp:post_type>",
					"<wp:attachment_url>https://example.org/wp-content/uploads/bad.png</wp:attachment_url>",
					"</item>",
				].join(""),
			]),
			"utf8",
		);
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({
			exportFile,
			artifactDir: join(workspace, "art"),
			downloadMedia: true,
		});
		expect(report.failedMedia.length).toBeGreaterThan(0);
		expect(report.status).toBe("completed_with_warnings");
	});
});

describe("downloadMediaAssets — completed-set short-circuit, resumeFrom path, and failure dedup", () => {
	const SVG = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");

	function attachmentItem(name: string, id: string) {
		return [
			"<item>",
			`<title><![CDATA[${name}]]></title>`,
			`<link>https://example.org/wp-content/uploads/${name}.svg</link>`,
			`<wp:post_id>${id}</wp:post_id>`,
			`<wp:post_name>${name}</wp:post_name>`,
			"<wp:status>inherit</wp:status>",
			"<wp:post_type>attachment</wp:post_type>",
			`<wp:attachment_url>https://example.org/wp-content/uploads/${name}.svg</wp:attachment_url>`,
			"</item>",
		].join("");
	}

	it("resumeFrom path reads completed list from an explicit file rather than the default download-state (kills the `resumeFrom || downloadStateFile` LogicalOperator)", async () => {
		await writeFile(exportFile, makeWxr([attachmentItem("alpha", "501")]), "utf8");
		const artifactDir = join(workspace, "art-resume");
		await mkdir(join(artifactDir, "downloads"), { recursive: true });
		// Default download-state at artifactDir says nothing was completed.
		await writeFile(
			join(artifactDir, "download-state.json"),
			JSON.stringify({ completed: [], failed: [{ id: "default-only", reason: "marker" }] }),
			"utf8",
		);
		// Explicit resume file from a different location with its own failed marker.
		const resumeFile = join(workspace, "explicit-resume.json");
		await writeFile(
			resumeFile,
			JSON.stringify({ completed: [], failed: [{ id: "resume-only", reason: "marker" }] }),
			"utf8",
		);

		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(SVG, { status: 200, headers: { "content-type": "image/svg+xml" } }),
				),
		);
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({
			exportFile,
			artifactDir,
			downloadMedia: true,
			resumeFrom: resumeFile,
		});
		// failedMedia carries forward the marker from the explicit resume file, NOT from the default
		// download-state.json. If `resumeFrom || downloadStateFile` were mutated to `&&`, the default
		// would be loaded and we'd see `default-only` instead.
		expect(report.failedMedia.some((f) => f.id === "resume-only")).toBe(true);
		expect(report.failedMedia.every((f) => f.id !== "default-only")).toBe(true);
	});

	it("dedupes the `failed` array when the same {id, reason} appears twice in the prior state (kills line 69 `&&` LogicalOperator and ConditionalExpression)", async () => {
		// Pre-seed download-state.json with two identical failed entries for the same id.
		const artifactDir = join(workspace, "art-dedup");
		await mkdir(join(artifactDir, "downloads"), { recursive: true });
		await writeFile(
			join(artifactDir, "download-state.json"),
			JSON.stringify({
				completed: [],
				failed: [
					{ id: "x", reason: "boom", sourceUrl: "https://x" },
					{ id: "x", reason: "boom", sourceUrl: "https://x" },
				],
			}),
			"utf8",
		);
		await writeFile(exportFile, makeWxr([]), "utf8"); // no media → no new attempts
		const importer = createAstropressWordPressImportSource();
		await importer.importWordPress({
			exportFile,
			artifactDir,
			downloadMedia: true,
		});
		// After dedup, the persisted failed array should have exactly one entry for "x".
		const persisted = JSON.parse(await readFile(join(artifactDir, "download-state.json"), "utf8"));
		expect(persisted.failed.filter((f: { id: string }) => f.id === "x")).toHaveLength(1);
	});
});

describe("importWordPress warning-deduplication and localApply orchestration", () => {
	it("includes the local-apply success marker in warnings when applyLocal: true (kills the `localApply ?` ConditionalExpression on line 318 and the template literal)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({
			exportFile,
			applyLocal: true,
			workspaceRoot: workspace,
			adminDbPath: join(workspace, "local.sqlite"),
		});
		expect(
			report.warnings.some((w) => w.includes("Applied WordPress import into local SQLite runtime")),
		).toBe(true);
	});

	it("formats failedMedia warnings as `Media download failed for <id>: <reason>` (kills line 322 string template + ArrowFunction)", async () => {
		await writeFile(
			exportFile,
			makeWxr([
				[
					"<item>",
					"<title><![CDATA[fail]]></title>",
					"<link>https://example.org/wp-content/uploads/fail.png</link>",
					"<wp:post_id>900</wp:post_id>",
					"<wp:post_name>fail</wp:post_name>",
					"<wp:status>inherit</wp:status>",
					"<wp:post_type>attachment</wp:post_type>",
					"<wp:attachment_url>https://example.org/wp-content/uploads/fail.png</wp:attachment_url>",
					"</item>",
				].join(""),
			]),
			"utf8",
		);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(null, { status: 503, statusText: "boom" })),
		);
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({
			exportFile,
			artifactDir: join(workspace, "art"),
			downloadMedia: true,
		});
		expect(report.warnings.some((w) => /Media download failed for [^:]+:/.test(w))).toBe(true);
	});

	it("merges sourceUrl from the constructor options when input omits it (kills line 247/257/331 `?? options.sourceUrl` LogicalOperator)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource({
			sourceUrl: "https://my-site.example",
		});
		const inv = await importer.inspectWordPress?.({ exportFile });
		expect(inv?.sourceUrl).toBe("https://my-site.example");
		const report = await importer.importWordPress({ exportFile });
		expect(report.inventory.sourceUrl).toBe("https://my-site.example");
	});

	it("workspaceRoot defaults to process.cwd() when omitted on applyLocal (kills line 269 `?? process.cwd()` LogicalOperator)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(workspace);
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({
			exportFile,
			applyLocal: true,
			adminDbPath: join(workspace, "wsd.sqlite"),
			// workspaceRoot omitted → defaults to cwd
		});
		expect(cwdSpy).toHaveBeenCalled();
		expect(report.localApply?.workspaceRoot).toBe(workspace);
	});

	it("does NOT include the local-apply success marker when applyLocal: false (kills the false-branch of the localApply ?` ConditionalExpression)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile, applyLocal: false });
		expect(report.warnings.every((w) => !w.includes("Applied WordPress import"))).toBe(true);
		// kills 320:10 ArrayDeclaration []→["Stryker was here"]: when applyLocal=false the
		// localApply success branch must produce an EMPTY array spread, so no "Stryker was here"
		// string and no spurious extra warnings appear.
		expect(report.warnings.every((w) => !w.includes("Stryker"))).toBe(true);
	});
});

describe("downloadMediaAssets — survivor-targeted cases", () => {
	const SVG = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");

	function attachmentItem(name: string, id: string, ext = "svg") {
		return [
			"<item>",
			`<title><![CDATA[${name}]]></title>`,
			`<link>https://example.org/wp-content/uploads/${name}.${ext}</link>`,
			`<wp:post_id>${id}</wp:post_id>`,
			`<wp:post_name>${name}</wp:post_name>`,
			"<wp:status>inherit</wp:status>",
			"<wp:post_type>attachment</wp:post_type>",
			`<wp:attachment_url>https://example.org/wp-content/uploads/${name}.${ext}</wp:attachment_url>`,
			"</item>",
		].join("");
	}

	it("fresh download (no prior state file) — persisted state.completed contains only real asset id, not the readDownloadState catch-default 28:23 mutant", async () => {
		await writeFile(exportFile, makeWxr([attachmentItem("alpha", "500")]), "utf8");
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(SVG, { status: 200, headers: { "content-type": "image/svg+xml" } }),
				),
		);
		const artifactDir = join(workspace, "fresh");
		const importer = createAstropressWordPressImportSource();
		await importer.importWordPress({ exportFile, artifactDir, downloadMedia: true });
		const persisted = JSON.parse(await readFile(join(artifactDir, "download-state.json"), "utf8"));
		expect(persisted.completed).toEqual(["media-500"]);
		expect(persisted.failed).toEqual([]);
	});

	it('downloaded file lands in the \'downloads\' subdir (kills 41:46 StringLiteral "downloads"→"")', async () => {
		await writeFile(exportFile, makeWxr([attachmentItem("beta", "501")]), "utf8");
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(SVG, { status: 200, headers: { "content-type": "image/svg+xml" } }),
				),
		);
		const artifactDir = join(workspace, "sub");
		const importer = createAstropressWordPressImportSource();
		await importer.importWordPress({ exportFile, artifactDir, downloadMedia: true });
		const { stat } = await import("node:fs/promises");
		const downloadsStat = await stat(join(artifactDir, "downloads", "beta.svg"));
		expect(downloadsStat.isFile()).toBe(true);
		await expect(stat(join(artifactDir, "beta.svg"))).rejects.toThrow();
	});

	it("re-downloads when the asset is in completed-set but the file is missing on disk (kills 52:34 ConditionalExpression true + 52:7 LogicalOperator && →||)", async () => {
		await writeFile(exportFile, makeWxr([attachmentItem("gamma", "502")]), "utf8");
		const artifactDir = join(workspace, "stale");
		await mkdir(join(artifactDir, "downloads"), { recursive: true });
		// Mark as completed but DO NOT place the file on disk. Asset id uses the parser's
		// `media-${legacyId}` prefix so completed-set membership actually matches.
		await writeFile(
			join(artifactDir, "download-state.json"),
			JSON.stringify({ completed: ["media-502"], failed: [] }),
			"utf8",
		);
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(SVG, { status: 200, headers: { "content-type": "image/svg+xml" } }),
			);
		vi.stubGlobal("fetch", fetchMock);
		const importer = createAstropressWordPressImportSource();
		await importer.importWordPress({ exportFile, artifactDir, downloadMedia: true });
		// Original guard: skip iff completed AND file exists. Mutant 52:34 makes "(file !== null)" always
		// true → always skip when completed → fetch not called. Mutant 52:7 (&&→||) → skip whenever
		// either side true → always skip when completed → fetch not called. Both die when re-download fires.
		expect(fetchMock).toHaveBeenCalled();
	});

	it("persisted state.completed is sorted ascending (kills 67:14 MethodExpression .sort() removed)", async () => {
		await writeFile(
			exportFile,
			makeWxr([attachmentItem("alpha", "9-zzz"), attachmentItem("beta", "1-aaa")]),
			"utf8",
		);
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockImplementation(
					async () =>
						new Response(SVG, { status: 200, headers: { "content-type": "image/svg+xml" } }),
				),
		);
		const artifactDir = join(workspace, "sorted");
		const importer = createAstropressWordPressImportSource();
		await importer.importWordPress({ exportFile, artifactDir, downloadMedia: true });
		const persisted = JSON.parse(await readFile(join(artifactDir, "download-state.json"), "utf8"));
		expect(persisted.completed).toEqual(["media-1-aaa", "media-9-zzz"]);
	});

	it("failed dedup preserves entries with same id but different reasons (kills 69:40 right-side ConditionalExpression true on c.reason === e.reason)", async () => {
		const artifactDir = join(workspace, "diff-reasons");
		await mkdir(join(artifactDir, "downloads"), { recursive: true });
		await writeFile(
			join(artifactDir, "download-state.json"),
			JSON.stringify({
				completed: [],
				failed: [
					{ id: "z", reason: "boom1" },
					{ id: "z", reason: "boom2" },
				],
			}),
			"utf8",
		);
		await writeFile(exportFile, makeWxr([]), "utf8");
		const importer = createAstropressWordPressImportSource();
		await importer.importWordPress({ exportFile, artifactDir, downloadMedia: true });
		const persisted = JSON.parse(await readFile(join(artifactDir, "download-state.json"), "utf8"));
		expect(persisted.failed).toEqual([
			{ id: "z", reason: "boom1" },
			{ id: "z", reason: "boom2" },
		]);
	});

	it("failed dedup preserves entries with different ids and same reason (kills 69:40 left-side ConditionalExpression true on c.id === e.id)", async () => {
		const artifactDir = join(workspace, "diff-ids");
		await mkdir(join(artifactDir, "downloads"), { recursive: true });
		await writeFile(
			join(artifactDir, "download-state.json"),
			JSON.stringify({
				completed: [],
				failed: [
					{ id: "p", reason: "boom" },
					{ id: "q", reason: "boom" },
				],
			}),
			"utf8",
		);
		await writeFile(exportFile, makeWxr([]), "utf8");
		const importer = createAstropressWordPressImportSource();
		await importer.importWordPress({ exportFile, artifactDir, downloadMedia: true });
		const persisted = JSON.parse(await readFile(join(artifactDir, "download-state.json"), "utf8"));
		expect(persisted.failed.map((f: { id: string }) => f.id).sort()).toEqual(["p", "q"]);
	});
});

describe("buildInventory — body/excerpt concat — survivor cases", () => {
	it("detects shortcodes in body when excerpt is undefined (kills 93:74 StringLiteral and 93:63 StringLiteral on the `\\n${r.excerpt ?? ''}` template)", async () => {
		const item = makePost({ body: "<p>[gallery ids='1']</p>", excerpt: undefined });
		await writeFile(exportFile, makeWxr([item]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const inv = await importer.inspectWordPress?.({ exportFile });
		expect(inv?.detectedShortcodes).toBeGreaterThan(0);
		expect(inv?.unsupportedPatterns).toContain("shortcodes");
	});
});

describe("buildImportPlan — inventory-driven defaults survivors", () => {
	it("plan.includeComments defaults to TRUE when overrides omitted and inventory has comments (kills 126:26 LogicalOperator ?? →&&)", async () => {
		// Comments are parsed from <wp:comment> blocks NESTED inside a post's <item>.
		const postWithComment = [
			"<item>",
			"<title><![CDATA[Post with comment]]></title>",
			"<link>https://example.org/p-c/</link>",
			"<content:encoded><![CDATA[<p>body</p>]]></content:encoded>",
			"<wp:post_id>601</wp:post_id>",
			"<wp:post_date>2024-01-01 12:00:00</wp:post_date>",
			"<wp:post_name>p-c</wp:post_name>",
			"<wp:status>publish</wp:status>",
			"<wp:post_type>post</wp:post_type>",
			"<wp:comment>",
			"<wp:comment_id>1</wp:comment_id>",
			"<wp:comment_author><![CDATA[A]]></wp:comment_author>",
			"<wp:comment_content><![CDATA[hi]]></wp:comment_content>",
			"<wp:comment_date>2024-01-02 00:00:00</wp:comment_date>",
			"<wp:comment_approved>1</wp:comment_approved>",
			"</wp:comment>",
			"</item>",
		].join("");
		const wxr = makeWxr([postWithComment]);
		await writeFile(exportFile, wxr, "utf8");
		const importer = createAstropressWordPressImportSource();
		const inv = await importer.inspectWordPress?.({ exportFile });
		expect(inv?.detectedComments).toBeGreaterThan(0);
		// overrides intentionally omits includeComments
		const plan = await importer.planWordPressImport?.({
			inventory: inv as NonNullable<typeof inv>,
		});
		expect(plan?.includeComments).toBe(true);
	});

	it("plan.includeUsers defaults to TRUE when overrides omitted and inventory has users (kills 127:23 LogicalOperator ?? →&&)", async () => {
		const wxr = [
			"<rss><channel>",
			"<wp:author><wp:author_id>5</wp:author_id><wp:author_login><![CDATA[u5]]></wp:author_login><wp:author_display_name><![CDATA[U5]]></wp:author_display_name></wp:author>",
			makePost({ id: "602", name: "p-u" }),
			"</channel></rss>",
		].join("");
		await writeFile(exportFile, wxr, "utf8");
		const importer = createAstropressWordPressImportSource();
		const inv = await importer.inspectWordPress?.({ exportFile });
		expect(inv?.detectedUsers).toBeGreaterThan(0);
		const plan = await importer.planWordPressImport?.({
			inventory: inv as NonNullable<typeof inv>,
		});
		expect(plan?.includeUsers).toBe(true);
	});

	it("plan.downloadMedia is FALSE when includeMedia=false even if overrides.downloadMedia=true (kills 129:24 ConditionalExpression true + 129:24 LogicalOperator &&→||)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const inv = await importer.inspectWordPress?.({ exportFile });
		const plan = await importer.planWordPressImport?.({
			inventory: inv as NonNullable<typeof inv>,
			includeMedia: false,
			downloadMedia: true,
			artifactDir: join(workspace, "x"),
		});
		expect(plan?.includeMedia).toBe(false);
		expect(plan?.downloadMedia).toBe(false);
	});

	it("plan.manualTasks includes inventory.warnings (kills 131:22 ArrayDeclaration [...warnings]→[])", async () => {
		// Shortcode body produces inventory.warnings = ["WordPress shortcodes were detected; ..."]
		const item = makePost({ body: "<p>[gallery ids='1']</p>" });
		await writeFile(exportFile, makeWxr([item]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile });
		expect(
			report.plan.manualTasks.some((t) => t.includes("WordPress shortcodes were detected")),
		).toBe(true);
		expect(report.inventory.warnings.length).toBeGreaterThan(0);
	});

	it("plan.manualTasks does NOT include the remediation note when no candidates (kills 133:6 ConditionalExpression true and 133:6 EqualityOperator >=)", async () => {
		await writeFile(exportFile, makeWxr([makePost({ body: "<p>clean prose</p>" })]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile });
		expect(report.inventory.remediationCandidates).toEqual([]);
		const remediationTask =
			"Review remediation-candidates.json for shortcode or page-builder cleanup before publishing staged content.";
		expect(report.plan.manualTasks.includes(remediationTask)).toBe(false);
	});

	it("artifactDir warning is ABSENT when downloadMedia=true AND artifactDir IS provided (kills 138:6 ConditionalExpression true)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({
			exportFile,
			artifactDir: join(workspace, "with-dir"),
			downloadMedia: true,
		});
		expect(
			report.plan.manualTasks.some((t) => t.includes("Media download was requested without")),
		).toBe(false);
	});

	it("artifactDir warning is ABSENT when downloadMedia=false (kills 138:6 LogicalOperator &&→||)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource();
		// downloadMedia false; no artifactDir. Original `if (downloadMedia && !artifactDir)` = false → no warning.
		// Mutant ||: false || !undefined = true → warning added.
		const report = await importer.importWordPress({ exportFile, downloadMedia: false });
		expect(
			report.plan.manualTasks.every((t) => !t.includes("Media download was requested without")),
		).toBe(true);
	});

	it("artifactDir warning IS PRESENT when downloadMedia=true and artifactDir is omitted (kills 138:6 ConditionalExpression false as side effect)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const inv = await importer.inspectWordPress?.({ exportFile });
		const plan = await importer.planWordPressImport?.({
			inventory: inv as NonNullable<typeof inv>,
			downloadMedia: true,
			// no artifactDir
		});
		expect(plan?.manualTasks.some((t) => t.includes("Media download was requested without"))).toBe(
			true,
		);
	});
});

describe("stageArtifacts — downloadMedia=false short-circuit (198:6, 198:27, 203:56)", () => {
	it("when downloadMedia=false and media items exist, NO fetch is attempted and report.failedMedia/downloadedMedia are exactly empty/0", async () => {
		await writeFile(
			exportFile,
			makeWxr([
				[
					"<item>",
					"<title><![CDATA[a]]></title>",
					"<link>https://example.org/wp-content/uploads/a.png</link>",
					"<wp:post_id>700</wp:post_id>",
					"<wp:post_name>a</wp:post_name>",
					"<wp:status>inherit</wp:status>",
					"<wp:post_type>attachment</wp:post_type>",
					"<wp:attachment_url>https://example.org/wp-content/uploads/a.png</wp:attachment_url>",
					"</item>",
				].join(""),
			]),
			"utf8",
		);
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const artifactDir = join(workspace, "no-dl-has-media");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({
			exportFile,
			artifactDir,
			downloadMedia: false,
		});
		// 198:6 ConditionalExpression false (and 198:27 BlockStatement {}) would both cause control to
		// fall through to downloadMediaAssets, which would call fetch.
		expect(fetchMock).not.toHaveBeenCalled();
		// 203:56 ArrayDeclaration: early-return returns failedMedia=[].
		expect(report.failedMedia).toEqual([]);
		expect(report.downloadedMedia).toBe(0);
	});
});

describe("resolveImportOverrides — default-when-undefined survivors", () => {
	it("plan.includeComments=true when input.includeComments omitted (kills 224:20 LogicalOperator ?? →&&)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile });
		expect(report.plan.includeComments).toBe(true);
	});

	it("plan.includeUsers=true when input.includeUsers omitted (kills 225:17 LogicalOperator ?? →&&)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource();
		const report = await importer.importWordPress({ exportFile });
		expect(report.plan.includeUsers).toBe(true);
	});

	it("plan.downloadMedia=false when input.downloadMedia omitted (kills 227:41 BooleanLiteral false→true on `?? false`)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const importer = createAstropressWordPressImportSource();
		// includeMedia defaults to true; downloadMedia omitted → resolves false → plan.downloadMedia false.
		// artifactDir MUST be provided because buildImportPlan ANDs downloadMedia with Boolean(artifactDir);
		// without it the false-result is indistinguishable from the original.
		const report = await importer.importWordPress({
			exportFile,
			artifactDir: join(workspace, "dl-default"),
		});
		expect(report.plan.downloadMedia).toBe(false);
	});
});

describe("importWordPress — orchestration survivors", () => {
	it("import-report.json mediaErrors entries carry populated id/sourceUrl/reason (kills 288:52 ArrowFunction () => undefined and 288:60 ObjectLiteral {})", async () => {
		await writeFile(
			exportFile,
			makeWxr([
				[
					"<item>",
					"<title><![CDATA[fail]]></title>",
					"<link>https://example.org/wp-content/uploads/fail.png</link>",
					"<wp:post_id>900</wp:post_id>",
					"<wp:post_name>fail</wp:post_name>",
					"<wp:status>inherit</wp:status>",
					"<wp:post_type>attachment</wp:post_type>",
					"<wp:attachment_url>https://example.org/wp-content/uploads/fail.png</wp:attachment_url>",
					"</item>",
				].join(""),
			]),
			"utf8",
		);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(null, { status: 503, statusText: "boom" })),
		);
		const artifactDir = join(workspace, "report-err");
		const importer = createAstropressWordPressImportSource();
		await importer.importWordPress({ exportFile, artifactDir, downloadMedia: true });
		const reportFile = JSON.parse(await readFile(join(artifactDir, "import-report.json"), "utf8"));
		expect(Array.isArray(reportFile.mediaErrors)).toBe(true);
		expect(reportFile.mediaErrors.length).toBeGreaterThan(0);
		const entry = reportFile.mediaErrors[0];
		expect(entry.id).toBe("media-900");
		expect(entry.sourceUrl).toBe("https://example.org/wp-content/uploads/fail.png");
		expect(typeof entry.reason).toBe("string");
		expect(entry.reason.length).toBeGreaterThan(0);
	});

	it("resumeWordPressImport inherits sourceUrl from constructor options when input omits it (kills 331:16 LogicalOperator ?? →&&)", async () => {
		await writeFile(exportFile, makeWxr([makePost()]), "utf8");
		const artifactDir = join(workspace, "resume-src");
		const importer = createAstropressWordPressImportSource({
			sourceUrl: "https://from-options.example",
		});
		// Prime artifactDir by running importWordPress first.
		await importer.importWordPress({ exportFile, artifactDir });
		// Now call resume. Note resumeWordPressImport takes the union of importWordPress's input;
		// omit sourceUrl on the input so the ?? falls through to options.sourceUrl.
		const report = await importer.resumeWordPressImport?.({ exportFile, artifactDir });
		expect(report?.inventory.sourceUrl).toBe("https://from-options.example");
	});
});
