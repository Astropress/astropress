export function createAstropressAuthorRepository(input) {
  return {
    listAuthors: (...args) => input.listAuthors(...args),
    createAuthor(rawInput, actor) {
      const name = rawInput.name.trim();
      const slug = input.slugifyTerm(rawInput.slug?.trim() || name);
      if (!name || !slug) {
        return { ok: false, error: "Author name and slug are required." };
      }

      const created = input.createAuthor({
        slug,
        name,
        bio: rawInput.bio?.trim() ?? "",
      });
      if (!created) {
        return { ok: false, error: "That author name or slug is already in use." };
      }

      input.recordAuthorAudit({
        actor,
        action: "author.create",
        summary: `Created author ${name}.`,
        targetId: slug,
      });
      return { ok: true };
    },
    updateAuthor(rawInput, actor) {
      const name = rawInput.name.trim();
      const slug = input.slugifyTerm(rawInput.slug?.trim() || name);
      if (!rawInput.id || !name || !slug) {
        return { ok: false, error: "Author id, name, and slug are required." };
      }

      const updated = input.updateAuthor({
        id: rawInput.id,
        slug,
        name,
        bio: rawInput.bio?.trim() ?? "",
      });
      if (!updated) {
        return { ok: false, error: "That author could not be updated." };
      }

      input.recordAuthorAudit({
        actor,
        action: "author.update",
        summary: `Updated author ${name}.`,
        targetId: String(rawInput.id),
      });
      return { ok: true };
    },
    deleteAuthor(id, actor) {
      const deleted = input.deleteAuthor(id);
      if (!deleted) {
        return { ok: false, error: "That author could not be deleted." };
      }

      input.recordAuthorAudit({
        actor,
        action: "author.delete",
        summary: `Deleted author ${id}.`,
        targetId: String(id),
      });
      return { ok: true };
    },
  };
}
