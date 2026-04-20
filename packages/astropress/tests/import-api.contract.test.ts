import type { DatabaseSync } from "node:sqlite";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import { registerCms } from "../src/config";
import type { AstropressWordPressImportReport } from "../src/platform-contracts.js";
import { createApiTokenStore } from "../src/sqlite-runtime/api-tokens.js";
import { makeDb } from "./helpers/make-db.js";

// ─── Hoisted mock functions ────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
	loadLocalAdminStore: vi.fn(),
	importWordPress: vi.fn(),
}));

vi.mock("@astropress-diy/astropress/local-runtime-modules", () => ({
	loadLocalAdminStore: mocks.loadLocalAdminStore,
}));

vi.mock("@astropress-diy/astropress/import/wordpress", () => ({
	createAstropressWordPressImportSource: () => ({
		importWordPress: mocks.importWordPress,
	}),
}));

// ─── Page handler import (after mocks) ───────────────────────────────────────

import { POST } from "../pages/ap-api/v1/import/wordpress.js";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const BASE = "http://localhost";

let db: DatabaseSync;
let importWriteToken: string;
let contentReadToken: string;

const MOCK_REPORT: AstropressWordPressImportReport = {
	status: "completed",
	importedRecords: 3,
	importedMedia: 1,
	importedComments: 0,
	importedUsers: 1,
	importedRedirects: 2,
	downloadedMedia: 0,
	failedMedia: [],
	reviewRequired: false,
	manualTasks: [],
	warnings: [],
	plan: {
		exportFile: "/tmp/export.xml",
		includeComments: true,
		includeUsers: true,
		includeMedia: true,
		downloadMedia: false,
		applyLocal: true,
		permalinkStrategy: "preserve-wordpress-links",
		resumeSupported: true,
		entityCounts: {
			posts: 2,
			pages: 1,
			attachments: 1,
			redirects: 2,
			comments: 0,
			users: 1,
			categories: 0,
			tags: 0,
		},
		reviewRequired: false,
		manualTasks: [],
	},
	inventory: {
		exportFile: "/tmp/export.xml",
		detectedRecords: 4,
		detectedMedia: 1,
		detectedComments: 0,
		detectedUsers: 1,
		detectedShortcodes: 0,
		detectedBuilderMarkers: 0,
		entityCounts: {
			posts: 2,
			pages: 1,
			attachments: 1,
			redirects: 2,
			comments: 0,
			users: 1,
			categories: 0,
			tags: 0,
		},
		unsupportedPatterns: [],
		remediationCandidates: [],
		warnings: [],
	},
};

beforeAll(async () => {
	db = makeDb();
	registerCms({
		templateKeys: ["content"],
		siteUrl: "https://example.com",
		seedPages: [],
		archives: [],
		translationStatus: [],
		api: { enabled: true },
	});

	const store = createApiTokenStore(db);
	importWriteToken = (
		await store.create({ label: "import", scopes: ["import:write"] })
	).rawToken;
	contentReadToken = (
		await store.create({ label: "read", scopes: ["content:read"] })
	).rawToken;
});

afterAll(() => {
	db.close();
});

beforeEach(() => {
	const apiTokens = createApiTokenStore(db);
	mocks.loadLocalAdminStore.mockResolvedValue({
		apiTokens,
		checkRateLimit: () => true,
	});
	mocks.importWordPress.mockResolvedValue(MOCK_REPORT);
});

// ─── Context builder ──────────────────────────────────────────────────────────

type AnyAPIContext = Parameters<typeof POST>[0];

function ctx(request: Request): AnyAPIContext {
	return { request, params: {}, locals: {} } as unknown as AnyAPIContext;
}

function req(opts: { token?: string; body?: unknown } = {}): Request {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
	return new Request(`${BASE}/ap-api/v1/import/wordpress`, {
		method: "POST",
		headers,
		body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
	});
}

// ─── POST /ap-api/v1/import/wordpress ────────────────────────────────────────

describe("POST /ap-api/v1/import/wordpress — auth and scope", () => {
	it("returns 401 without Authorization header", async () => {
		const res = await POST(
			ctx(req({ body: { exportFile: "/tmp/export.xml" } })),
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 when token lacks import:write scope", async () => {
		const res = await POST(
			ctx(
				req({
					token: contentReadToken,
					body: { exportFile: "/tmp/export.xml" },
				}),
			),
		);
		expect(res.status).toBe(403);
	});

	it("returns 404 when API is disabled", async () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: false },
		});
		const res = await POST(
			ctx(
				req({
					token: importWriteToken,
					body: { exportFile: "/tmp/export.xml" },
				}),
			),
		);
		expect(res.status).toBe(404);
		// Restore
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: true },
		});
	});
});

describe("POST /ap-api/v1/import/wordpress — request validation", () => {
	it("returns 422 when exportFile is missing from body", async () => {
		const res = await POST(ctx(req({ token: importWriteToken, body: {} })));
		expect(res.status).toBe(422);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.code).toBe("validation_error");
	});

	it("returns 422 when exportFile is empty string", async () => {
		const res = await POST(
			ctx(req({ token: importWriteToken, body: { exportFile: "  " } })),
		);
		expect(res.status).toBe(422);
	});
});

describe("POST /ap-api/v1/import/wordpress — success path", () => {
	it("returns 200 with AstropressWordPressImportReport shape", async () => {
		const res = await POST(
			ctx(
				req({
					token: importWriteToken,
					body: { exportFile: "/tmp/export.xml" },
				}),
			),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.status).toBe("completed");
		expect(typeof body.importedRecords).toBe("number");
		expect(typeof body.importedMedia).toBe("number");
		expect(Array.isArray(body.failedMedia)).toBe(true);
		expect(typeof body.reviewRequired).toBe("boolean");
	});

	it("calls importWordPress with the provided exportFile and applyLocal: true", async () => {
		await POST(
			ctx(
				req({
					token: importWriteToken,
					body: { exportFile: "/tmp/export.xml" },
				}),
			),
		);
		expect(mocks.importWordPress).toHaveBeenCalledWith(
			expect.objectContaining({
				exportFile: "/tmp/export.xml",
				applyLocal: true,
			}),
		);
	});

	it("returns completed_with_warnings status when import has warnings", async () => {
		mocks.importWordPress.mockResolvedValueOnce({
			...MOCK_REPORT,
			status: "completed_with_warnings",
			reviewRequired: true,
			warnings: ["Review remediation-candidates.json"],
		});
		const res = await POST(
			ctx(
				req({
					token: importWriteToken,
					body: { exportFile: "/tmp/export.xml" },
				}),
			),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { status: string; warnings: string[] };
		expect(body.status).toBe("completed_with_warnings");
		expect(body.warnings.length).toBeGreaterThan(0);
	});
});
