// astropress/packages/astropress/src/platform-contracts.ts
function normalizeProviderCapabilities(partial) {
  return {
    name: partial.name,
    staticPublishing: partial.staticPublishing ?? false,
    hostedAdmin: partial.hostedAdmin ?? false,
    previewEnvironments: partial.previewEnvironments ?? false,
    serverRuntime: partial.serverRuntime ?? false,
    database: partial.database ?? false,
    objectStorage: partial.objectStorage ?? false,
    gitSync: partial.gitSync ?? false
  };
}
function assertProviderContract(adapter) {
  if (!adapter.capabilities.name) {
    throw new Error("Provider adapter must declare a name.");
  }
  if (!adapter.content || !adapter.media || !adapter.revisions || !adapter.auth) {
    throw new Error("Provider adapter is missing one or more required stores.");
  }
  return adapter;
}

// astropress/packages/astropress/src/config.ts
var CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");
function getConfigStore() {
  return globalThis;
}
function getCmsConfig() {
  const config = getConfigStore()[CMS_CONFIG_KEY] ?? null;
  if (!config) {
    throw new Error("CMS not initialized — call registerCms() before using the CMS.");
  }
  return config;
}

// astropress/packages/astropress/src/site-settings.ts
var defaultSiteSettings = {
  siteTitle: "",
  siteTagline: "",
  donationUrl: "",
  newsletterEnabled: false,
  commentsDefaultPolicy: "legacy-readonly",
  adminSlug: "wp-admin"
};

// astropress/packages/astropress/src/translation-state.ts
var translationStates = [
  "not_started",
  "partial",
  "fallback_en",
  "translated",
  "reviewed",
  "published"
];
var legacyStateMap = {
  original: "not_started",
  "in-progress": "partial",
  "pending-review": "translated",
  approved: "reviewed",
  "needs-revision": "partial",
  archived: "fallback_en",
  complete: "published"
};
function normalizeTranslationState(value, fallback = "not_started") {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (translationStates.includes(normalized)) {
    return normalized;
  }
  return legacyStateMap[normalized] ?? fallback;
}

// astropress/packages/astropress/src/d1-admin-store.ts
function getPageRecords() {
  return getCmsConfig().seedPages;
}
async function getCustomContentEntries(db) {
  const rows = (await db.prepare(`
          SELECT slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary,
                 seo_title, meta_description, og_title, og_description, og_image
          FROM content_entries
          ORDER BY datetime(updated_at) DESC, slug ASC
        `).all()).results;
  return rows.map((row) => ({
    slug: row.slug,
    legacyUrl: row.legacy_url,
    title: row.title,
    templateKey: row.template_key,
    listingItems: [],
    paginationLinks: [],
    sourceHtmlPath: row.source_html_path,
    updatedAt: row.updated_at,
    body: row.body ?? "",
    summary: row.summary ?? "",
    seoTitle: row.seo_title ?? row.title,
    metaDescription: row.meta_description ?? row.summary ?? "",
    ogTitle: row.og_title ?? undefined,
    ogDescription: row.og_description ?? undefined,
    ogImage: row.og_image ?? undefined,
    kind: row.kind,
    status: "draft"
  }));
}
async function getAllContentRecords(db) {
  return [...getPageRecords(), ...await getCustomContentEntries(db)];
}
async function findPageRecord(db, slug) {
  const records = await getAllContentRecords(db);
  return records.find((entry) => entry.slug === slug || entry.legacyUrl === `/${slug}`) ?? null;
}
function mapPersistedOverride(row) {
  if (!row) {
    return null;
  }
  return {
    title: row.title,
    status: row.status,
    scheduledAt: row.scheduled_at ?? undefined,
    body: row.body ?? undefined,
    seoTitle: row.seo_title,
    metaDescription: row.meta_description,
    excerpt: row.excerpt ?? undefined,
    ogTitle: row.og_title ?? undefined,
    ogDescription: row.og_description ?? undefined,
    ogImage: row.og_image ?? undefined,
    canonicalUrlOverride: row.canonical_url_override ?? undefined,
    robotsDirective: row.robots_directive ?? undefined
  };
}
function parseIdList(value) {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry) && entry > 0);
  } catch {
    return [];
  }
}
async function getD1ContentAssignmentIds(db, slug) {
  const [authorRows, categoryRows, tagRows] = await Promise.all([
    db.prepare("SELECT author_id FROM content_authors WHERE slug = ? ORDER BY author_id ASC").bind(slug).all(),
    db.prepare("SELECT category_id FROM content_categories WHERE slug = ? ORDER BY category_id ASC").bind(slug).all(),
    db.prepare("SELECT tag_id FROM content_tags WHERE slug = ? ORDER BY tag_id ASC").bind(slug).all()
  ]);
  return {
    authorIds: authorRows.results.map((row) => row.author_id),
    categoryIds: categoryRows.results.map((row) => row.category_id),
    tagIds: tagRows.results.map((row) => row.tag_id)
  };
}
function createD1AdminReadStore(db) {
  async function getPersistedContentOverride(slug) {
    const row = await db.prepare(`
          SELECT title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image,
                 canonical_url_override, robots_directive
          FROM content_overrides
          WHERE slug = ?
          LIMIT 1
        `).bind(slug).first();
    return mapPersistedOverride(row);
  }
  return {
    audit: {
      async getAuditEvents() {
        const rows = (await db.prepare(`
                SELECT id, user_email, action, resource_type, resource_id, summary, created_at
                FROM audit_events
                ORDER BY datetime(created_at) DESC, id DESC
              `).all()).results;
        return rows.map((row) => ({
          id: `d1-audit-${row.id}`,
          action: row.action,
          actorEmail: row.user_email,
          actorRole: "admin",
          summary: row.summary,
          targetType: row.resource_type === "redirect" || row.resource_type === "comment" || row.resource_type === "content" ? row.resource_type : "auth",
          targetId: row.resource_id ?? `${row.id}`,
          createdAt: row.created_at
        }));
      }
    },
    users: {
      async listAdminUsers() {
        const rows = (await db.prepare(`
                SELECT
                  id,
                  email,
                  role,
                  name,
                  active,
                  created_at,
                  EXISTS (
                    SELECT 1
                    FROM user_invites i
                    WHERE i.user_id = admin_users.id
                      AND i.accepted_at IS NULL
                      AND datetime(i.expires_at) > CURRENT_TIMESTAMP
                  ) AS has_pending_invite
                FROM admin_users
                ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, datetime(created_at) ASC, email ASC
              `).all()).results;
        return rows.map((row) => ({
          id: row.id,
          email: row.email,
          role: row.role,
          name: row.name,
          active: row.active === 1,
          status: row.active !== 1 ? "suspended" : row.has_pending_invite === 1 ? "invited" : "active",
          createdAt: row.created_at
        }));
      }
    },
    authors: {
      async listAuthors() {
        const rows = (await db.prepare(`
                SELECT id, slug, name, bio, created_at, updated_at
                FROM authors
                WHERE deleted_at IS NULL
                ORDER BY name COLLATE NOCASE ASC, id ASC
              `).all()).results;
        return rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          bio: row.bio ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));
      }
    },
    taxonomies: {
      async listCategories() {
        const rows = (await db.prepare(`
                SELECT id, slug, name, description, created_at, updated_at
                FROM categories
                WHERE deleted_at IS NULL
                ORDER BY name COLLATE NOCASE ASC, id ASC
              `).all()).results;
        return rows.map((row) => ({
          id: row.id,
          kind: "category",
          slug: row.slug,
          name: row.name,
          description: row.description ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));
      },
      async listTags() {
        const rows = (await db.prepare(`
                SELECT id, slug, name, description, created_at, updated_at
                FROM tags
                WHERE deleted_at IS NULL
                ORDER BY name COLLATE NOCASE ASC, id ASC
              `).all()).results;
        return rows.map((row) => ({
          id: row.id,
          kind: "tag",
          slug: row.slug,
          name: row.name,
          description: row.description ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));
      }
    },
    redirects: {
      async getRedirectRules() {
        const rows = (await db.prepare(`
                SELECT source_path, target_path, status_code
                FROM redirect_rules
                WHERE deleted_at IS NULL
                ORDER BY source_path ASC
              `).all()).results;
        return rows.map((row) => ({
          sourcePath: row.source_path,
          targetPath: row.target_path,
          statusCode: row.status_code
        }));
      }
    },
    comments: {
      async getComments() {
        const rows = (await db.prepare(`
                SELECT id, author, email, body, route, status, policy, submitted_at
                FROM comments
                ORDER BY
                  CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                  datetime(submitted_at) DESC,
                  id DESC
              `).all()).results;
        return rows.map((row) => ({
          id: row.id,
          author: row.author,
          email: row.email ?? undefined,
          body: row.body ?? undefined,
          route: row.route,
          status: row.status,
          policy: row.policy,
          submittedAt: row.submitted_at
        }));
      },
      async getApprovedCommentsForRoute(route) {
        const comments = await this.getComments();
        return comments.filter((comment) => comment.route === route && comment.status === "approved");
      }
    },
    content: {
      async listContentStates() {
        const records = await getAllContentRecords(db);
        const states = await Promise.all(records.map(async (record) => this.getContentState(record.slug)));
        return states.filter((record) => Boolean(record));
      },
      async getContentState(slug) {
        const pageRecord = await findPageRecord(db, slug);
        if (!pageRecord) {
          return null;
        }
        const override = await getPersistedContentOverride(pageRecord.slug);
        const assignments = await getD1ContentAssignmentIds(db, pageRecord.slug);
        return {
          ...pageRecord,
          title: override?.title ?? pageRecord.title,
          status: override?.status ?? (pageRecord.status ?? "published"),
          scheduledAt: override?.scheduledAt,
          body: override?.body ?? pageRecord.body,
          authorIds: assignments.authorIds,
          categoryIds: assignments.categoryIds,
          tagIds: assignments.tagIds,
          seoTitle: override?.seoTitle ?? pageRecord.seoTitle ?? pageRecord.title,
          metaDescription: override?.metaDescription ?? pageRecord.metaDescription ?? pageRecord.summary ?? "",
          excerpt: override?.excerpt ?? pageRecord.summary,
          ogTitle: override?.ogTitle,
          ogDescription: override?.ogDescription,
          ogImage: override?.ogImage,
          canonicalUrlOverride: override?.canonicalUrlOverride,
          robotsDirective: override?.robotsDirective
        };
      },
      async getContentRevisions(slug) {
        const pageRecord = await findPageRecord(db, slug);
        if (!pageRecord) {
          return null;
        }
        const rows = (await db.prepare(`
                SELECT id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title,
                       og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_at, created_by
                FROM content_revisions
                WHERE slug = ?
                ORDER BY datetime(created_at) DESC, id DESC
              `).bind(pageRecord.slug).all()).results;
        return rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          status: row.status,
          scheduledAt: row.scheduled_at ?? undefined,
          body: row.body ?? undefined,
          authorIds: parseIdList(row.author_ids),
          categoryIds: parseIdList(row.category_ids),
          tagIds: parseIdList(row.tag_ids),
          seoTitle: row.seo_title,
          metaDescription: row.meta_description,
          excerpt: row.excerpt ?? undefined,
          ogTitle: row.og_title ?? undefined,
          ogDescription: row.og_description ?? undefined,
          ogImage: row.og_image ?? undefined,
          canonicalUrlOverride: row.canonical_url_override ?? undefined,
          robotsDirective: row.robots_directive ?? undefined,
          source: row.source,
          createdAt: row.created_at,
          revisionNote: row.revision_note ?? undefined,
          createdBy: row.created_by ?? undefined
        }));
      }
    },
    submissions: {
      async getContactSubmissions() {
        const rows = (await db.prepare(`
                SELECT id, name, email, message, submitted_at
                FROM contact_submissions
                ORDER BY datetime(submitted_at) DESC, id DESC
              `).all()).results;
        return rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          message: row.message,
          submittedAt: row.submitted_at
        }));
      }
    },
    translations: {
      async getEffectiveTranslationState(route, fallback = "not_started") {
        const row = await db.prepare("SELECT state FROM translation_overrides WHERE route = ? LIMIT 1").bind(route).first();
        return normalizeTranslationState(row?.state, normalizeTranslationState(fallback));
      }
    },
    settings: {
      async getSettings() {
        const row = await db.prepare(`
              SELECT site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug
              FROM site_settings
              WHERE id = 1
              LIMIT 1
            `).first();
        if (!row) {
          return { ...defaultSiteSettings };
        }
        return {
          siteTitle: row.site_title,
          siteTagline: row.site_tagline,
          donationUrl: row.donation_url,
          newsletterEnabled: row.newsletter_enabled === 1,
          commentsDefaultPolicy: row.comments_default_policy,
          adminSlug: row.admin_slug ?? "wp-admin"
        };
      }
    },
    rateLimits: {
      async checkRateLimit(key, max, windowMs) {
        const now = Date.now();
        const row = await db.prepare("SELECT count, window_start_ms, window_ms FROM rate_limits WHERE key = ? LIMIT 1").bind(key).first();
        if (!row || now - row.window_start_ms > windowMs) {
          await db.prepare(`
                INSERT INTO rate_limits (key, count, window_start_ms, window_ms)
                VALUES (?, 1, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                  count = 1,
                  window_start_ms = excluded.window_start_ms,
                  window_ms = excluded.window_ms
              `).bind(key, now, windowMs).run();
          return true;
        }
        if (row.count < max) {
          await db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
          return true;
        }
        return false;
      },
      async peekRateLimit(key, max, windowMs) {
        const now = Date.now();
        const row = await db.prepare("SELECT count, window_start_ms FROM rate_limits WHERE key = ? LIMIT 1").bind(key).first();
        if (!row || now - row.window_start_ms > windowMs)
          return true;
        return row.count < max;
      },
      async recordFailedAttempt(key, max, windowMs) {
        const now = Date.now();
        const row = await db.prepare("SELECT count, window_start_ms FROM rate_limits WHERE key = ? LIMIT 1").bind(key).first();
        if (!row || now - row.window_start_ms > windowMs) {
          await db.prepare(`
                INSERT INTO rate_limits (key, count, window_start_ms, window_ms)
                VALUES (?, 1, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                  count = 1,
                  window_start_ms = excluded.window_start_ms,
                  window_ms = excluded.window_ms
              `).bind(key, now, windowMs).run();
          return;
        }
        await db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
      }
    },
    media: {
      async listMediaAssets() {
        const rows = (await db.prepare(`
                SELECT id, source_url, local_path, r2_key, mime_type, width, height, file_size, alt_text, title, uploaded_at, uploaded_by
                FROM media_assets
                WHERE deleted_at IS NULL
                ORDER BY datetime(uploaded_at) DESC, id DESC
              `).all()).results;
        return rows.map((row) => ({
          id: row.id,
          sourceUrl: row.source_url,
          localPath: row.local_path,
          r2Key: row.r2_key,
          mimeType: row.mime_type,
          width: row.width,
          height: row.height,
          fileSize: row.file_size,
          altText: row.alt_text ?? "",
          title: row.title ?? "",
          uploadedAt: row.uploaded_at,
          uploadedBy: row.uploaded_by ?? ""
        }));
      }
    }
  };
}

// astropress/packages/astropress/src/adapters/cloudflare.ts
function unsupportedCloudflareWrite(operation) {
  throw new Error(`Cloudflare adapter does not support ${operation} yet. Use the runtime admin surface for mutations.`);
}
function mapContentRecordKind(record) {
  return record.kind === "post" ? "post" : "page";
}
function toContentStoreRecord(record) {
  return {
    id: record.slug,
    kind: mapContentRecordKind(record),
    slug: record.slug,
    status: record.status === "review" ? "draft" : record.status,
    title: record.title,
    body: record.body ?? null,
    metadata: {
      seoTitle: record.seoTitle,
      metaDescription: record.metaDescription,
      updatedAt: record.updatedAt,
      legacyUrl: record.legacyUrl,
      templateKey: record.templateKey,
      summary: record.summary ?? ""
    }
  };
}
function toRedirectRecord(rule) {
  return {
    id: rule.sourcePath,
    kind: "redirect",
    slug: rule.sourcePath,
    status: "published",
    title: rule.sourcePath,
    metadata: {
      targetPath: rule.targetPath,
      statusCode: rule.statusCode
    }
  };
}
function createFallbackCloudflareAuthStore(seedUsers) {
  const users = new Map(seedUsers.map((user) => [user.email.toLowerCase(), user]));
  const sessions = new Map;
  return {
    async signIn(email, password) {
      const user = users.get(email.trim().toLowerCase());
      if (!user || user.password !== password) {
        return null;
      }
      const sessionId = `cloudflare-session:${user.id}`;
      const sessionUser = { id: sessionId, email: user.email, role: user.role };
      sessions.set(sessionId, sessionUser);
      return sessionUser;
    },
    async signOut(sessionId) {
      sessions.delete(sessionId);
    },
    async getSession(sessionId) {
      return sessions.get(sessionId) ?? null;
    }
  };
}
function createAstropressCloudflareAdapter(options = {}) {
  if (!options.db) {
    return assertProviderContract({
      capabilities: normalizeProviderCapabilities({
        name: "cloudflare",
        staticPublishing: true,
        hostedAdmin: true,
        previewEnvironments: true,
        serverRuntime: true,
        database: true,
        objectStorage: true,
        gitSync: true
      }),
      content: {
        async list() {
          return [];
        },
        async get() {
          return null;
        },
        async save(record) {
          return record;
        },
        async delete() {}
      },
      media: {
        async put(asset) {
          return asset;
        },
        async get() {
          return null;
        },
        async delete() {}
      },
      revisions: {
        async list() {
          return [];
        },
        async append(revision) {
          return revision;
        }
      },
      auth: options.auth ?? createFallbackCloudflareAuthStore(options.users ?? [{ id: "admin-1", email: "admin@example.com", role: "admin", password: "password" }]),
      gitSync: options.gitSync,
      deploy: options.deploy,
      importer: options.importer,
      preview: options.preview
    });
  }
  const readStore = createD1AdminReadStore(options.db);
  return assertProviderContract({
    capabilities: normalizeProviderCapabilities({
      name: "cloudflare",
      staticPublishing: true,
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: true,
      gitSync: true
    }),
    auth: options.auth ?? createFallbackCloudflareAuthStore(options.users ?? [{ id: "admin-1", email: "admin@example.com", role: "admin", password: "password" }]),
    content: {
      async list(kind) {
        const records = [];
        if (!kind || kind === "page" || kind === "post") {
          for (const record of await readStore.content.listContentStates()) {
            const mapped = toContentStoreRecord(record);
            if (!kind || mapped.kind === kind) {
              records.push(mapped);
            }
          }
        }
        if (!kind || kind === "redirect") {
          records.push(...(await readStore.redirects.getRedirectRules()).map((rule) => toRedirectRecord(rule)));
        }
        if (!kind || kind === "comment") {
          records.push(...(await readStore.comments.getComments()).map((comment) => ({
            id: comment.id,
            kind: "comment",
            slug: comment.id,
            status: comment.status === "approved" ? "published" : "draft",
            title: comment.author,
            body: comment.body ?? null,
            metadata: {
              route: comment.route,
              email: comment.email ?? null,
              policy: comment.policy,
              submittedAt: comment.submittedAt ?? null
            }
          })));
        }
        if (!kind || kind === "user") {
          records.push(...(await readStore.users.listAdminUsers()).map((user) => ({
            id: String(user.id),
            kind: "user",
            slug: user.email,
            status: user.active ? "published" : "archived",
            title: user.name,
            metadata: {
              email: user.email,
              role: user.role,
              createdAt: user.createdAt,
              userStatus: user.status
            }
          })));
        }
        if (!kind || kind === "settings") {
          const settings = await readStore.settings.getSettings();
          records.push({
            id: "site-settings",
            kind: "settings",
            slug: "site-settings",
            status: "published",
            title: settings.siteTitle,
            metadata: settings
          });
        }
        if (!kind || kind === "media") {
          records.push(...(await readStore.media.listMediaAssets()).map((asset) => ({
            id: asset.id,
            kind: "media",
            slug: asset.id,
            status: "published",
            title: asset.title || asset.id,
            metadata: {
              sourceUrl: asset.sourceUrl,
              localPath: asset.localPath,
              mimeType: asset.mimeType,
              altText: asset.altText,
              uploadedAt: asset.uploadedAt
            }
          })));
        }
        return records;
      },
      async get(id) {
        const normalizedId = id.trim();
        if (!normalizedId) {
          return null;
        }
        const all = await this.list();
        return all.find((record) => record.id === normalizedId || record.slug === normalizedId) ?? null;
      },
      async save() {
        unsupportedCloudflareWrite("content.save");
      },
      async delete() {
        unsupportedCloudflareWrite("content.delete");
      }
    },
    media: {
      async put(_asset) {
        unsupportedCloudflareWrite("media.put");
      },
      async get(id) {
        const asset = (await readStore.media.listMediaAssets()).find((entry) => entry.id === id);
        if (!asset) {
          return null;
        }
        return {
          id: asset.id,
          filename: asset.title || asset.id,
          mimeType: asset.mimeType ?? "application/octet-stream",
          publicUrl: asset.sourceUrl ?? asset.localPath,
          metadata: {
            altText: asset.altText,
            uploadedAt: asset.uploadedAt
          }
        };
      },
      async delete() {
        unsupportedCloudflareWrite("media.delete");
      }
    },
    revisions: {
      async list(recordId) {
        return (await readStore.content.getContentRevisions(recordId) ?? []).map((revision) => ({
          id: revision.id,
          recordId: revision.slug,
          createdAt: revision.createdAt,
          actorId: revision.createdBy ?? null,
          summary: revision.revisionNote ?? null,
          snapshot: revision
        }));
      },
      async append() {
        unsupportedCloudflareWrite("revisions.append");
      }
    },
    gitSync: options.gitSync,
    deploy: options.deploy,
    importer: options.importer,
    preview: options.preview
  });
}
export {
  createAstropressCloudflareAdapter
};
