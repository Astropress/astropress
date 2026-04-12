export function mapContentRecordKind(record) {
  return record.kind === "post" ? "post" : "page";
}

export function nowIso() {
  return new Date().toISOString();
}

export function cloudflareActorEmail() {
  return "admin@example.com";
}

export function normalizeContentStatus(status) {
  return status === "archived" ? "archived" : status === "draft" ? "draft" : "published";
}

export function toContentStoreRecord(record) {
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
      summary: record.summary ?? "",
    },
  };
}

export function toRedirectRecord(rule) {
  return {
    id: rule.sourcePath,
    kind: "redirect",
    slug: rule.sourcePath,
    status: "published",
    title: rule.sourcePath,
    metadata: {
      targetPath: rule.targetPath,
      statusCode: rule.statusCode,
    },
  };
}

export function toTranslationRecord(route, state, updatedAt, updatedBy) {
  return {
    id: route,
    kind: "translation",
    slug: route,
    status: state === "published" ? "published" : "draft",
    title: route,
    metadata: { state, updatedAt, updatedBy },
  };
}

export async function listTranslationRecords(db) {
  const rows = (
    await db
      .prepare("SELECT route, state, updated_at, updated_by FROM translation_overrides ORDER BY route ASC")
      .all()
  ).results;

  return rows.map((row) => toTranslationRecord(row.route, row.state, row.updated_at, row.updated_by));
}

export async function saveD1Revision(db, revision, actorEmail) {
  const snapshot = revision.snapshot;
  await db
    .prepare(
      `
        INSERT INTO content_revisions (
          id, slug, source, title, status, scheduled_at, body, seo_title, meta_description, excerpt,
          og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override,
          robots_directive, revision_note, created_at, created_by
        ) VALUES (?, ?, 'reviewed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      revision.id,
      revision.recordId,
      String(snapshot.title ?? revision.recordId),
      snapshot.status === "archived" ? "archived" : snapshot.status === "draft" ? "draft" : "published",
      snapshot.scheduledAt ?? null,
      snapshot.body ?? null,
      String(snapshot.seoTitle ?? snapshot.title ?? revision.recordId),
      String(snapshot.metaDescription ?? snapshot.title ?? revision.recordId),
      snapshot.excerpt ?? null,
      snapshot.ogTitle ?? null,
      snapshot.ogDescription ?? null,
      snapshot.ogImage ?? null,
      JSON.stringify(snapshot.authorIds ?? []),
      JSON.stringify(snapshot.categoryIds ?? []),
      JSON.stringify(snapshot.tagIds ?? []),
      snapshot.canonicalUrlOverride ?? null,
      snapshot.robotsDirective ?? null,
      revision.summary ?? null,
      revision.createdAt,
      revision.actorId ?? actorEmail,
    )
    .run();
}
