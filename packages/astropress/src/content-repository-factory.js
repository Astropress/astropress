function normalizeAssignments(values) {
  return [...new Set((values ?? []).filter((entry) => Number.isInteger(entry) && entry > 0))];
}

function mapContentState(record, override, assignments) {
  return {
    ...record,
    title: override?.title ?? record.title,
    status: override?.status ?? record.status,
    scheduledAt: override?.scheduledAt,
    body: override?.body ?? record.body,
    authorIds: assignments.authorIds,
    categoryIds: assignments.categoryIds,
    tagIds: assignments.tagIds,
    seoTitle: override?.seoTitle ?? record.seoTitle,
    metaDescription: override?.metaDescription ?? record.metaDescription,
    excerpt: override?.excerpt ?? record.excerpt,
    ogTitle: override?.ogTitle,
    ogDescription: override?.ogDescription,
    ogImage: override?.ogImage,
    canonicalUrlOverride: override?.canonicalUrlOverride,
    robotsDirective: override?.robotsDirective,
  };
}

export function createAstropressContentRepository(input) {
  function getContentState(slug) {
    const record = input.findContentRecord(slug);
    if (!record) {
      return null;
    }

    return mapContentState(record, input.getPersistedOverride(record.slug), input.getContentAssignments(record.slug));
  }

  return {
    listContentStates() {
      return input
        .listContentRecords()
        .map((record) => getContentState(record.slug))
        .filter(Boolean)
        .sort((left, right) => Date.parse(right.updatedAt ?? "") - Date.parse(left.updatedAt ?? ""));
    },
    getContentState,
    getContentRevisions(slug) {
      const record = input.findContentRecord(slug);
      if (!record) {
        return null;
      }

      input.ensureBaselineRevision(record);
      return input.listPersistedRevisions(record.slug);
    },
    restoreRevision(slug, revisionId, actor) {
      const record = input.findContentRecord(slug);
      if (!record) {
        return { ok: false, error: "The selected content record could not be found." };
      }

      input.ensureBaselineRevision(record);
      const revision = input.getPersistedRevision(record.slug, revisionId);
      if (!revision) {
        return { ok: false, error: "Revision not found." };
      }

      input.upsertContentOverride(record.slug, {
        title: revision.title,
        status: revision.status,
        scheduledAt: revision.scheduledAt,
        body: revision.body,
        seoTitle: revision.seoTitle,
        metaDescription: revision.metaDescription,
        excerpt: revision.excerpt,
        ogTitle: revision.ogTitle,
        ogDescription: revision.ogDescription,
        ogImage: revision.ogImage,
        canonicalUrlOverride: revision.canonicalUrlOverride,
        robotsDirective: revision.robotsDirective,
      }, actor);

      input.replaceContentAssignments(record.slug, {
        authorIds: revision.authorIds ?? [],
        categoryIds: revision.categoryIds ?? [],
        tagIds: revision.tagIds ?? [],
      });

      input.insertReviewedRevision(record.slug, {
        title: revision.title,
        status: revision.status,
        scheduledAt: revision.scheduledAt,
        body: revision.body,
        seoTitle: revision.seoTitle,
        metaDescription: revision.metaDescription,
        excerpt: revision.excerpt,
        ogTitle: revision.ogTitle,
        ogDescription: revision.ogDescription,
        ogImage: revision.ogImage,
        authorIds: revision.authorIds,
        categoryIds: revision.categoryIds,
        tagIds: revision.tagIds,
        canonicalUrlOverride: revision.canonicalUrlOverride,
        robotsDirective: revision.robotsDirective,
        revisionNote: revision.revisionNote,
      }, actor);

      input.recordContentAudit({
        actor,
        action: "content.restore",
        summary: `Restored revision ${revisionId} for ${slug}.`,
        targetId: record.slug,
      });

      return { ok: true };
    },
    saveContentState(slug, rawInput, actor) {
      const record = input.findContentRecord(slug);
      if (!record) {
        return { ok: false, error: "The selected content record could not be found." };
      }

      const title = rawInput.title.trim();
      const seoTitle = rawInput.seoTitle.trim();
      const metaDescription = rawInput.metaDescription.trim();
      const status = input.normalizeContentStatus(rawInput.status);
      const body = rawInput.body?.trim() || record.body || "";
      const scheduledAt = rawInput.scheduledAt?.trim() ? new Date(rawInput.scheduledAt).toISOString() : undefined;
      const revisionNote = rawInput.revisionNote?.trim() || undefined;

      if (!title || !seoTitle || !metaDescription) {
        return { ok: false, error: "Title, SEO title, and meta description are required." };
      }

      input.ensureBaselineRevision(record);
      const assignments = {
        authorIds: normalizeAssignments(rawInput.authorIds),
        categoryIds: normalizeAssignments(rawInput.categoryIds),
        tagIds: normalizeAssignments(rawInput.tagIds),
      };

      input.upsertContentOverride(record.slug, {
        title,
        status,
        scheduledAt,
        body,
        seoTitle,
        metaDescription,
        excerpt: rawInput.excerpt?.trim() || undefined,
        ogTitle: rawInput.ogTitle?.trim() || undefined,
        ogDescription: rawInput.ogDescription?.trim() || undefined,
        ogImage: rawInput.ogImage?.trim() || undefined,
        canonicalUrlOverride: rawInput.canonicalUrlOverride?.trim() || undefined,
        robotsDirective: rawInput.robotsDirective?.trim() || undefined,
        metadata: rawInput.metadata,
      }, actor);

      input.replaceContentAssignments(record.slug, assignments);
      input.insertReviewedRevision(record.slug, {
        title,
        status,
        scheduledAt,
        body,
        seoTitle,
        metaDescription,
        excerpt: rawInput.excerpt?.trim() || undefined,
        ogTitle: rawInput.ogTitle?.trim() || undefined,
        ogDescription: rawInput.ogDescription?.trim() || undefined,
        ogImage: rawInput.ogImage?.trim() || undefined,
        authorIds: assignments.authorIds,
        categoryIds: assignments.categoryIds,
        tagIds: assignments.tagIds,
        canonicalUrlOverride: rawInput.canonicalUrlOverride?.trim() || undefined,
        robotsDirective: rawInput.robotsDirective?.trim() || undefined,
        revisionNote,
      }, actor);

      input.recordContentAudit({
        actor,
        action: "content.update",
        summary: `Updated reviewed metadata for ${record.legacyUrl}.`,
        targetId: record.slug,
      });

      return { ok: true, state: getContentState(record.slug) };
    },
    createContentRecord(rawInput, actor) {
      const title = rawInput.title.trim();
      const slug = input.slugifyTerm(rawInput.slug);
      const legacyUrl = input.normalizePath(rawInput.legacyUrl?.trim() || `/${slug}`);
      const seoTitle = rawInput.seoTitle.trim() || title;
      const metaDescription = rawInput.metaDescription.trim();
      const status = input.normalizeContentStatus(rawInput.status);
      const body = rawInput.body?.trim() || "";
      const summary = rawInput.summary?.trim() || "";

      if (!title || !slug || !metaDescription) {
        return { ok: false, error: "Title, slug, and meta description are required." };
      }

      if (input.findContentRecord(slug) || input.findContentRecord(legacyUrl.replace(/^\//, ""))) {
        return { ok: false, error: "That slug is already in use." };
      }

      const inserted = input.insertContentEntry({
        slug,
        legacyUrl,
        title,
        body,
        summary,
        seoTitle,
        metaDescription,
        ogTitle: rawInput.ogTitle?.trim() || undefined,
        ogDescription: rawInput.ogDescription?.trim() || undefined,
        ogImage: rawInput.ogImage?.trim() || undefined,
      });
      if (!inserted) {
        return { ok: false, error: "That slug or route is already in use." };
      }

      input.upsertContentOverride(slug, {
        title,
        status,
        body,
        seoTitle,
        metaDescription,
        excerpt: rawInput.excerpt?.trim() || summary || undefined,
        ogTitle: rawInput.ogTitle?.trim() || undefined,
        ogDescription: rawInput.ogDescription?.trim() || undefined,
        ogImage: rawInput.ogImage?.trim() || undefined,
        canonicalUrlOverride: rawInput.canonicalUrlOverride?.trim() || undefined,
        robotsDirective: rawInput.robotsDirective?.trim() || undefined,
      }, actor);

      input.insertReviewedRevision(slug, {
        title,
        status,
        body,
        seoTitle,
        metaDescription,
        excerpt: rawInput.excerpt?.trim() || summary || undefined,
        ogTitle: rawInput.ogTitle?.trim() || undefined,
        ogDescription: rawInput.ogDescription?.trim() || undefined,
        ogImage: rawInput.ogImage?.trim() || undefined,
        canonicalUrlOverride: rawInput.canonicalUrlOverride?.trim() || undefined,
        robotsDirective: rawInput.robotsDirective?.trim() || undefined,
        revisionNote: "Created new post.",
      }, actor);

      input.recordContentAudit({
        actor,
        action: "content.create",
        summary: `Created post ${legacyUrl}.`,
        targetId: slug,
      });

      return { ok: true, state: getContentState(slug) };
    },
  };
}
