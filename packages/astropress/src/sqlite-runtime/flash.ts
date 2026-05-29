import { randomBytes } from "node:crypto";
import type { FlashStore } from "../platform-contracts-helpers";
import type { AstropressSqliteDatabaseLike } from "./utils";

/** Default lifetime of a flash entry — long enough for the redirect, short
 * enough that an abandoned hand-off can't be replayed later. */
export const FLASH_DEFAULT_TTL_MS = 5 * 60 * 1000;

interface FlashRow {
	payload: string;
	expires_at_ms: number;
}

/** Opaque, non-guessable flash id. 18 random bytes → 36 hex chars. */
export function newFlashId(): string {
	return `flash_${randomBytes(18).toString("hex")}`;
}

/**
 * sqlite sibling of {@link FlashStore}. Single-read-then-delete: `consume`
 * always deletes the row it read, so a payload can never be retrieved twice
 * even if the same id is replayed. Expired rows are treated as absent and are
 * swept opportunistically on each `put`.
 */
export function createFlashStore(db: AstropressSqliteDatabaseLike): FlashStore {
	return {
		async put(payload, ttlMs = FLASH_DEFAULT_TTL_MS) {
			const now = Date.now();
			db.prepare("DELETE FROM admin_flash WHERE expires_at_ms <= ?").run(now);
			const id = newFlashId();
			db.prepare(
				"INSERT INTO admin_flash (id, payload, created_at_ms, expires_at_ms) VALUES (?, ?, ?, ?)",
			).run(id, payload, now, now + ttlMs);
			return { id };
		},

		async consume(id) {
			const row = db
				.prepare("SELECT payload, expires_at_ms FROM admin_flash WHERE id = ?")
				.get(id) as FlashRow | undefined;
			// Delete unconditionally: a read is a consume even when expired, so a
			// replay of the same id can never succeed.
			db.prepare("DELETE FROM admin_flash WHERE id = ?").run(id);
			if (!row || row.expires_at_ms <= Date.now()) {
				return null;
			}
			return row.payload;
		},
	};
}
