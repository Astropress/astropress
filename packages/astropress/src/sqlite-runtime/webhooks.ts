import { createHmac, randomBytes } from "node:crypto";
import type { WebhookEvent, WebhookRecord, WebhookStore } from "../platform-contracts";
import type { AstropressSqliteDatabaseLike } from "./utils";
import { createLogger } from "../runtime-logger";

const logger = createLogger("Webhook");

// Webhook signing secrets are stored in plain text because they are needed
// to compute outgoing HMAC signatures. This is the standard approach used by
// GitHub, Stripe, and other services. The secret is shown to the admin once;
// the DB holds the same value for use when signing dispatched requests.
// The column is named secret_hash for backwards-compat with the schema DDL.

interface WebhookRow {
  id: string;
  url: string;
  events: string;
  secret_hash: string; // stores the raw signing secret (field naming is historical)
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

export function createWebhookStore(db: AstropressSqliteDatabaseLike, fetchImpl: typeof fetch = fetch): WebhookStore {
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
      const signingSecret = randomBytes(32).toString("hex");
      const now = new Date().toISOString();

      db.prepare(
        "INSERT INTO webhooks (id, url, events, secret_hash, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
      ).run(id, url, JSON.stringify(events), signingSecret, now);

      const record: WebhookRecord = {
        id,
        url,
        events,
        active: true,
        createdAt: now,
        lastFiredAt: null,
      };

      return { record, signingSecret };
    },

    async delete(id) {
      const now = new Date().toISOString();
      db.prepare("UPDATE webhooks SET deleted_at = ?, active = 0 WHERE id = ?").run(now, id);
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

      const bodyText = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
      const now = new Date().toISOString();

      await Promise.allSettled(
        subscribers.map(async (row) => {
          const signature = `sha256=${createHmac("sha256", row.secret_hash).update(bodyText).digest("hex")}`;
          try {
            await fetchImpl(new Request(row.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Astropress-Event": event,
                "X-Astropress-Signature": signature,
              },
              body: bodyText,
            }));
          } catch (err) {
            logger.error(`Failed to dispatch ${event} to ${row.url}`, { error: err });
            return;
          }

          db.prepare("UPDATE webhooks SET last_fired_at = ? WHERE id = ?").run(now, row.id);
        }),
      );
    },
  };
}
