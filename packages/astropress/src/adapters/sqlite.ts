import type {
	AstropressPlatformAdapter,
	MediaAssetRecord,
	RevisionRecord,
} from "../platform-contracts";
import { normalizeProviderCapabilities } from "../platform-contracts";
import { registerHealthCheck } from "../runtime-health";
import { createAstropressSqliteAdminRuntime } from "../sqlite-admin-runtime";
import {
	type AstropressSqliteSeedToolkit,
	createDefaultAstropressSqliteSeedToolkit,
} from "../sqlite-bootstrap";
import {
	appendSqliteRevision,
	deleteSqliteContentRecord,
	getSqliteMedia,
	listSqliteContentRecords,
	putSqliteMedia,
	saveSqliteContentRecord,
} from "./sqlite-helpers.js";

export interface AstropressSqliteAdapterOptions {
	dbPath?: string;
	workspaceRoot?: string;
	seedToolkit?: AstropressSqliteSeedToolkit;
}

export function createAstropressSqliteAdapter(
	options: AstropressSqliteAdapterOptions = {},
): AstropressPlatformAdapter {
	const seedToolkit =
		options.seedToolkit ?? createDefaultAstropressSqliteSeedToolkit();
	const workspaceRoot = options.workspaceRoot ?? process.cwd();
	const dbPath =
		options.dbPath ?? seedToolkit.getDefaultAdminDbPath(workspaceRoot);
	let seeded = false;
	let database: ReturnType<
		AstropressSqliteSeedToolkit["openSeedDatabase"]
	> | null = null;

	function ensureDatabase() {
		if (!seeded) {
			seedToolkit.seedDatabase({ dbPath, workspaceRoot });
			seeded = true;
		}
		if (!database) {
			database = seedToolkit.openSeedDatabase(dbPath);
		}
		return database;
	}

	registerHealthCheck(() => {
		ensureDatabase().prepare("SELECT 1").get();
	});

	const actor = {
		email: "admin@example.com",
		role: "admin" as const,
		name: "Astropress SQLite",
	};
	const runtime = createAstropressSqliteAdminRuntime({
		getDatabase: ensureDatabase,
	});

	return {
		capabilities: normalizeProviderCapabilities({
			name: "sqlite",
			hostedAdmin: true,
			previewEnvironments: true,
			serverRuntime: true,
			database: true,
			objectStorage: false,
			gitSync: true,
		}),
		auth: {
			async signIn(email, password) {
				const user = await runtime.authenticatePersistedAdminUser(
					email,
					password,
				);
				if (!user) return null;
				const sessionId = runtime.sqliteAdminStore.auth.createSession(user, {});
				runtime.sqliteAdminStore.auth.recordSuccessfulLogin(user);
				return { id: sessionId, email: user.email, role: user.role };
			},
			async signOut(sessionId) {
				const user = runtime.sqliteAdminStore.auth.getSessionUser(sessionId);
				runtime.sqliteAdminStore.auth.revokeSession(sessionId);
				if (user) runtime.sqliteAdminStore.auth.recordLogout(user);
			},
			async getSession(sessionId) {
				const user = runtime.sqliteAdminStore.auth.getSessionUser(sessionId);
				return user
					? { id: sessionId, email: user.email, role: user.role }
					: null;
			},
		},
		content: {
			async list(kind) {
				return listSqliteContentRecords(runtime, ensureDatabase, kind);
			},
			async get(id) {
				const normalizedId = id.trim();
				if (!normalizedId) return null;
				const all = await this.list();
				return (
					all.find(
						(record) =>
							record.id === normalizedId || record.slug === normalizedId,
					) ?? null
				);
			},
			async save(record) {
				return saveSqliteContentRecord(runtime, record, actor);
			},
			async delete(id) {
				const existing = await this.get(id);
				if (!existing) return;
				deleteSqliteContentRecord(runtime, existing, actor);
			},
		},
		media: {
			async put(asset: MediaAssetRecord) {
				putSqliteMedia(ensureDatabase, asset, actor.email);
				return asset;
			},
			async get(id) {
				return getSqliteMedia(runtime, id);
			},
			async delete(id) {
				runtime.sqliteAdminStore.media.deleteMediaAsset(id, actor);
			},
		},
		revisions: {
			async list(recordId) {
				return (
					runtime.sqliteAdminStore.content.getContentRevisions(recordId) ?? []
				).map(
					(revision): RevisionRecord => ({
						id: revision.id,
						recordId: revision.slug,
						createdAt: revision.createdAt,
						actorId: revision.createdBy ?? null,
						summary: revision.revisionNote ?? null,
						snapshot: revision as unknown as Record<string, unknown>,
					}),
				);
			},
			async append(revision) {
				appendSqliteRevision(
					ensureDatabase,
					revision as {
						id: string;
						recordId: string;
						snapshot: Record<string, unknown>;
						summary?: string | null;
						createdAt: string;
						actorId?: string | null;
					},
					actor.email,
				);
				return revision;
			},
		},
	};
}
