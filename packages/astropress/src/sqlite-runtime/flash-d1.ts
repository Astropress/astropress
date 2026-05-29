/**
 * D1 sibling of `flash.ts`. Implements the same {@link FlashStore} contract,
 * but every method awaits D1's promise-returning SDK calls. The SQL bodies are
 * byte-for-byte the same as the sqlite store so both backends behave
 * identically; the only difference is the async driver shape. The dispatch
 * seam (`admin-store-dispatch.ts` `resolveFlashStore`) picks the backend. See
 * the secret-in-URL class, issues #113/#115/#133.
 */

import type { D1DatabaseLike } from "../d1-database";
import type { FlashStore } from "../platform-contracts-helpers";
import { FLASH_DEFAULT_TTL_MS, newFlashId } from "./flash";

interface FlashRow {
	payload: string;
	expires_at_ms: number;
}

export function createD1FlashStore(db: D1DatabaseLike): FlashStore {
	return {
		async put(payload, ttlMs = FLASH_DEFAULT_TTL_MS) {
			const now = Date.now();
			await db.prepare("DELETE FROM admin_flash WHERE expires_at_ms <= ?").bind(now).run();
			const id = newFlashId();
			await db
				.prepare(
					"INSERT INTO admin_flash (id, payload, created_at_ms, expires_at_ms) VALUES (?, ?, ?, ?)",
				)
				.bind(id, payload, now, now + ttlMs)
				.run();
			return { id };
		},

		async consume(id) {
			const row = await db
				.prepare("SELECT payload, expires_at_ms FROM admin_flash WHERE id = ?")
				.bind(id)
				.first<FlashRow>();
			// Delete unconditionally so a replay of the same id can never succeed.
			await db.prepare("DELETE FROM admin_flash WHERE id = ?").bind(id).run();
			if (!row || row.expires_at_ms <= Date.now()) {
				return null;
			}
			return row.payload;
		},
	};
}
