/**
 * D1 sibling of `api-tokens.ts`. Implements the same {@link ApiTokenStore}
 * contract, but every method awaits D1's promise-returning SDK calls. The raw
 * SQL bodies and column lists are byte-for-byte the same as the sqlite store so
 * the two backends produce identical token rows; the only difference is the
 * async driver shape (`.bind().run()` / `.bind().first()` / `.bind().all()`).
 *
 * Why a separate file rather than parameterising `api-tokens.ts`: the sqlite
 * store's `db` is the synchronous `node:sqlite` / `better-sqlite3` surface,
 * while D1 exposes only promise-returning calls. The dispatch seam
 * (`admin-store-dispatch.ts` `resolveApiRuntime`) is the single place that
 * picks the backend, so REST handlers never depend on the local runtime alias
 * on a D1-backed host. See issue #137.
 */

import { randomBytes } from "node:crypto";
import type { D1DatabaseLike } from "../d1-database";
import type { ApiScope, ApiTokenRecord, ApiTokenStore } from "../platform-contracts";
import { hashOpaqueToken } from "./utils";

interface ApiTokenRow {
	id: string;
	label: string;
	scopes: string;
	created_at: string;
	expires_at: string | null;
	last_used_at: string | null;
	revoked_at: string | null;
}

const SELECT_COLUMNS = "id, label, scopes, created_at, expires_at, last_used_at, revoked_at";

function rowToRecord(row: ApiTokenRow): ApiTokenRecord {
	return {
		id: row.id,
		label: row.label,
		scopes: JSON.parse(row.scopes) as ApiScope[],
		createdAt: row.created_at,
		expiresAt: row.expires_at ?? null,
		lastUsedAt: row.last_used_at ?? null,
		revokedAt: row.revoked_at ?? null,
	};
}

export function createD1ApiTokenStore(db: D1DatabaseLike): ApiTokenStore {
	return {
		async create({ label, scopes, expiresAt }) {
			const id = `tok_${randomBytes(12).toString("hex")}`;
			const rawToken = randomBytes(32).toString("hex");
			const tokenHash = hashOpaqueToken(rawToken);
			const now = new Date().toISOString();

			await db
				.prepare(
					"INSERT INTO api_tokens (id, label, token_hash, scopes, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
				)
				.bind(id, label, tokenHash, JSON.stringify(scopes), now, expiresAt ?? null)
				.run();

			const record: ApiTokenRecord = {
				id,
				label,
				scopes,
				createdAt: now,
				expiresAt: expiresAt ?? null,
				lastUsedAt: null,
				revokedAt: null,
			};

			return { record, rawToken };
		},

		async list() {
			const { results } = await db
				.prepare(`SELECT ${SELECT_COLUMNS} FROM api_tokens ORDER BY created_at DESC`)
				.all<ApiTokenRow>();
			return results.map(rowToRecord);
		},

		async verify(rawToken) {
			const tokenHash = hashOpaqueToken(rawToken);
			const row = await db
				.prepare(`SELECT ${SELECT_COLUMNS} FROM api_tokens WHERE token_hash = ?`)
				.bind(tokenHash)
				.first<ApiTokenRow>();

			if (!row) {
				return { valid: false, reason: "Token not found." };
			}

			if (row.revoked_at) {
				return { valid: false, reason: "Token has been revoked." };
			}

			if (row.expires_at && new Date(row.expires_at) < new Date()) {
				return { valid: false, reason: "Token has expired." };
			}

			const now = new Date().toISOString();
			await db
				.prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?")
				.bind(now, row.id)
				.run();
			row.last_used_at = now;

			return { valid: true, record: rowToRecord(row) };
		},

		async revoke(id) {
			const now = new Date().toISOString();
			await db.prepare("UPDATE api_tokens SET revoked_at = ? WHERE id = ?").bind(now, id).run();
		},
	};
}
