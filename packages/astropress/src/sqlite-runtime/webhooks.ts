import { randomBytes } from "node:crypto";
import {
	createMlDsaKeyPair,
	secretKeyToBase64,
	signMlDsaMessage,
} from "../crypto-primitives";
import type {
	WebhookEvent,
	WebhookRecord,
	WebhookStore,
} from "../platform-contracts";
import { createLogger } from "../runtime-logger";
import type { AstropressSqliteDatabaseLike } from "./utils";

const logger = createLogger("Webhook");

// The historical secret_hash column stores the ML-DSA-65 private signing key
// in base64 form. The verification key is returned once at creation time.

interface WebhookRow {
	id: string;
	url: string;
	events: string;
	secret_hash: string; // stores the ML-DSA secret key (field naming is historical)
	active: number;
	created_at: string;
	last_fired_at: string | null;
}

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

export function createWebhookStore(
	db: AstropressSqliteDatabaseLike,
	fetchImpl: typeof fetch = fetch,
): WebhookStore {
	return {
		async list() {
			const rows = db
				.prepare(
					"SELECT id, url, events, secret_hash, active, created_at, last_fired_at FROM webhooks WHERE deleted_at IS NULL ORDER BY created_at DESC",
				)
				.all() as WebhookRow[];
			return rows.map(rowToRecord);
		},

		async create({ url, events }) {
			const id = `wh_${randomBytes(12).toString("hex")}`;
			const keyPair = createMlDsaKeyPair(id, randomBytes(32));
			const now = new Date().toISOString();

			db.prepare(
				"INSERT INTO webhooks (id, url, events, secret_hash, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
			).run(
				id,
				url,
				JSON.stringify(events),
				secretKeyToBase64(keyPair.secretKey),
				now,
			);

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
			db.prepare(
				"UPDATE webhooks SET deleted_at = ?, active = 0 WHERE id = ?",
			).run(now, id);
		},

		async dispatch(event, payload) {
			const rows = db
				.prepare(
					"SELECT id, url, events, secret_hash, active, created_at, last_fired_at FROM webhooks WHERE deleted_at IS NULL AND active = 1",
				)
				.all() as WebhookRow[];

			const subscribers = rows.filter((row) => {
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

					db.prepare("UPDATE webhooks SET last_fired_at = ? WHERE id = ?").run(
						now,
						row.id,
					);
				}),
			);
		},
	};
}
