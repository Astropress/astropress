import { DatabaseSync } from "node:sqlite";

import { hashPassword } from "../../src/crypto-utils.js";
import { readAstropressSqliteSchemaSql } from "../../src/sqlite-bootstrap.js";
import type { D1DatabaseLike, D1PreparedStatement, D1Result } from "../../src/d1-database";

export class SqliteD1PreparedStatement implements D1PreparedStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new SqliteD1PreparedStatement(this.db, this.sql, values);
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }

    if (columnName) {
      return ((row[columnName] ?? null) as T) ?? null;
    }

    return row as T;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const results = this.db.prepare(this.sql).all(...this.params) as T[];
    return { success: true, results };
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const result = this.db.prepare(this.sql).run(...this.params);
    return { success: true, results: [], meta: { changes: result.changes } };
  }
}

export class SqliteBackedD1Database implements D1DatabaseLike {
  constructor(private readonly db: DatabaseSync) {}

  prepare(query: string): D1PreparedStatement {
    return new SqliteD1PreparedStatement(this.db, query);
  }
}

export function createHostedStores() {
  const contentRecords = new Map<string, { id: string; slug: string; title: string }>();

  return {
    content: {
      async list() {
        return [...contentRecords.values()].map((record) => ({
          id: record.id,
          kind: "post" as const,
          slug: record.slug,
          status: "published" as const,
          title: record.title,
        }));
      },
      async get(id: string) {
        const record = contentRecords.get(id);
        return record
          ? {
              id: record.id,
              kind: "post" as const,
              slug: record.slug,
              status: "published" as const,
              title: record.title,
            }
          : null;
      },
      async save(record: { id: string; slug: string; title?: string | null }) {
        contentRecords.set(record.id, {
          id: record.id,
          slug: record.slug,
          title: String(record.title ?? record.id),
        });
        return {
          ...record,
          kind: "post" as const,
          status: "published" as const,
        };
      },
      async delete(id: string) {
        contentRecords.delete(id);
      },
    },
    media: {
      async put(asset: { id: string; filename: string; mimeType: string }) {
        return asset;
      },
      async get() {
        return null;
      },
      async delete() {},
    },
    revisions: {
      async list() {
        return [];
      },
      async append(revision: { id: string; recordId: string; createdAt: string; snapshot: Record<string, unknown> }) {
        return revision;
      },
    },
    auth: {
      async signIn(email: string) {
        return { id: "hosted-session", email, role: "admin" as const };
      },
      async signOut() {},
      async getSession(sessionId: string) {
        return { id: sessionId, email: "admin@example.com", role: "admin" as const };
      },
    },
  };
}

export async function createSeededCloudflareDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(readAstropressSqliteSchemaSql());
  db.prepare(
    `
      INSERT INTO admin_users (
        email, password_hash, role, name, active
      ) VALUES (?, ?, ?, ?, ?)
    `,
  ).run("admin@example.com", await hashPassword("password"), "admin", "Cloudflare Admin", 1);
  db.prepare(
    `
      INSERT INTO content_entries (
        slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    "cloudflare-post",
    "/cloudflare-post",
    "Cloudflare post",
    "post",
    "content",
    "runtime://content/cloudflare-post",
    "<p>Cloudflare body</p>",
    "Cloudflare summary",
    "Cloudflare SEO",
    "Cloudflare description",
  );
  db.prepare(
    `
      INSERT INTO content_overrides (
        slug, title, status, body, seo_title, meta_description, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    "cloudflare-post",
    "Cloudflare post",
    "published",
    "<p>Cloudflare body</p>",
    "Cloudflare SEO",
    "Cloudflare description",
    "admin@example.com",
  );
  db.prepare(
    `
      INSERT INTO content_revisions (
        id, slug, source, title, status, body, seo_title, meta_description, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    "revision-cloudflare-1",
    "cloudflare-post",
    "reviewed",
    "Cloudflare post",
    "published",
    "<p>Cloudflare body</p>",
    "Cloudflare SEO",
    "Cloudflare description",
    "admin@example.com",
  );
  db.prepare(
    `
      INSERT INTO media_assets (
        id, source_url, local_path, mime_type, alt_text, title, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    "cloudflare-media-1",
    "https://cdn.example.com/cloudflare.png",
    "/media/cloudflare.png",
    "image/png",
    "Cloudflare alt",
    "cloudflare.png",
    "admin@example.com",
  );

  return db;
}
