/**
 * D1 sibling of `webhooks.ts`. Implements the same {@link WebhookStore}
 * contract over D1's promise-returning SDK. The SQL bodies and column lists
 * match the sqlite store byte-for-byte; the ML-DSA signing surface
 * (`createMlDsaKeyPair` / `signMlDsaMessage`) is shared and host-agnostic.
 *
 * The dispatch seam (`admin-store-dispatch.ts` `resolveApiRuntime`) selects
 * this backend whenever a D1 binding is present, so the REST webhook surface
 * and the admin webhook UI no longer require the local runtime alias on a
 * D1-backed host. See issue #137.
 */

import { randomBytes } from "node:crypto";
import { createMlDsaKeyPair, secretKeyToBase64, signMlDsaMessage } from "../crypto-primitives";
import type { D1DatabaseLike } from "../d1-database";
import type { WebhookEvent, WebhookRecord, WebhookStore } from "../platform-contracts";
import { createLogger } from "../runtime-logger";

const logger = createLogger("Webhook");

interface WebhookRow {
	id: string;
	url: string;
	events: string;
	secret_hash: string; // stores the ML-DSA secret key (field naming is historical)
	active: number;
	created_at: string;
	last_fired_at: string | null;
}

const SELECT_COLUMNS = "id, url, events, secret_hash, active, created_at, last_fired_at";

function rowToRecord(row: WebhookRow): WebhookRecord {
	return {
		id: row.id,
		url: row.url,
		events: JSON.parse(row.events) as WebhookEvent[],
		active: row.active === 1,
		createdAt: row.created_at,
		lastFiredAt: row.last_fired_at ?? null,
	};
}

export function createD1WebhookStore(
	db: D1DatabaseLike,
	fetchImpl: typeof fetch = fetch,
): WebhookStore {
	return {
		async list() {
			const { results } = await db
				.prepare(
					`SELECT ${SELECT_COLUMNS} FROM webhooks WHERE deleted_at IS NULL ORDER BY created_at DESC`,
				)
				.all<WebhookRow>();
			return results.map(rowToRecord);
		},

		async create({ url, events }) {
			const id = `wh_${randomBytes(12).toString("hex")}`;
			const keyPair = createMlDsaKeyPair(id, randomBytes(32));
			const now = new Date().toISOString();

			await db
				.prepare(
					"INSERT INTO webhooks (id, url, events, secret_hash, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
				)
				.bind(id, url, JSON.stringify(events), secretKeyToBase64(keyPair.secretKey), now)
				.run();

			const record: WebhookRecord = {
				id,
				url,
				events,
				active: true,
				createdAt: now,
				lastFiredAt: null,
			};

			return { record, verification: keyPair.verification };
		},

		async delete(id) {
			const now = new Date().toISOString();
			await db
				.prepare("UPDATE webhooks SET deleted_at = ?, active = 0 WHERE id = ?")
				.bind(now, id)
				.run();
		},

		async dispatch(event, payload) {
			const { results } = await db
				.prepare(`SELECT ${SELECT_COLUMNS} FROM webhooks WHERE deleted_at IS NULL AND active = 1`)
				.all<WebhookRow>();

			const subscribers = results.filter((row) => {
				const events = JSON.parse(row.events) as WebhookEvent[];
				return events.includes(event);
			});

			if (subscribers.length === 0) return;

			const bodyText = JSON.stringify({
				event,
				payload,
				timestamp: new Date().toISOString(),
			});
			const now = new Date().toISOString();

			await Promise.allSettled(
				subscribers.map(async (row) => {
					const signature = signMlDsaMessage(bodyText, row.secret_hash);
					try {
						await fetchImpl(
							new Request(row.url, {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
									"X-Astropress-Event": event,
									"X-Astropress-Signature": signature,
									"X-Astropress-Signature-Alg": "ML-DSA-65",
									"X-Astropress-Key-Id": row.id,
								},
								body: bodyText,
							}),
						);
					} catch (err) {
						logger.error(`Failed to dispatch ${event} to ${row.url}`, {
							error: err,
						});
						return;
					}

					await db
						.prepare("UPDATE webhooks SET last_fired_at = ? WHERE id = ?")
						.bind(now, row.id)
						.run();
				}),
			);
		},
	};
}
