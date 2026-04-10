import { randomBytes } from "node:crypto";
import type { ApiScope, ApiTokenRecord, ApiTokenStore } from "../platform-contracts";
import type { AstropressSqliteDatabaseLike } from "./utils";
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

export function createApiTokenStore(db: AstropressSqliteDatabaseLike): ApiTokenStore {
  return {
    async create({ label, scopes, expiresAt }) {
      const id = `tok_${randomBytes(12).toString("hex")}`;
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashOpaqueToken(rawToken);
      const now = new Date().toISOString();

      db.prepare(
        "INSERT INTO api_tokens (id, label, token_hash, scopes, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(id, label, tokenHash, JSON.stringify(scopes), now, expiresAt ?? null);

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
      const rows = db
        .prepare("SELECT id, label, scopes, created_at, expires_at, last_used_at, revoked_at FROM api_tokens ORDER BY created_at DESC")
        .all() as ApiTokenRow[];
      return rows.map(rowToRecord);
    },

    async verify(rawToken) {
      const tokenHash = hashOpaqueToken(rawToken);
      const row = db
        .prepare(
          "SELECT id, label, scopes, created_at, expires_at, last_used_at, revoked_at FROM api_tokens WHERE token_hash = ?",
        )
        .get(tokenHash) as ApiTokenRow | undefined;

      if (!row) {
        return { valid: false, reason: "Token not found." };
      }

      if (row.revoked_at) {
        return { valid: false, reason: "Token has been revoked." };
      }

      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        return { valid: false, reason: "Token has expired." };
      }

      // Update last_used_at
      const now = new Date().toISOString();
      db.prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").run(now, row.id);
      row.last_used_at = now;

      return { valid: true, record: rowToRecord(row) };
    },

    async revoke(id) {
      const now = new Date().toISOString();
      db.prepare("UPDATE api_tokens SET revoked_at = ? WHERE id = ?").run(now, id);
    },
  };
}
