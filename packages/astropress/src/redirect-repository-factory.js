export function createAstropressRedirectRepository(input) {
  return {
    getRedirectRules: (...args) => input.getRedirectRules(...args),
    createRedirectRule(rawInput, actor) {
      const sourcePath = input.normalizePath(rawInput.sourcePath);
      const targetPath = input.normalizePath(rawInput.targetPath);
      const statusCode = rawInput.statusCode === 302 ? 302 : 301;

      if (!sourcePath || !targetPath) {
        return { ok: false, error: "Both legacy and target paths are required." };
      }

      if (sourcePath === targetPath) {
        return { ok: false, error: "Legacy and target paths must be different." };
      }

      const existing = input.getExistingRedirect(sourcePath);
      if (existing && existing.deletedAt === null) {
        return { ok: false, error: "That legacy path already has a reviewed redirect rule." };
      }

      input.upsertRedirect({
        sourcePath,
        targetPath,
        statusCode,
        actor,
      });

      input.recordRedirectAudit({
        actor,
        action: "redirect.create",
        summary: `Created redirect ${sourcePath} -> ${targetPath} (${statusCode}).`,
        targetId: sourcePath,
      });

      return { ok: true, rule: { sourcePath, targetPath, statusCode } };
    },
    deleteRedirectRule(sourcePath, actor) {
      const normalizedSourcePath = input.normalizePath(sourcePath);
      const deleted = input.markRedirectDeleted(normalizedSourcePath);
      if (!deleted) {
        return { ok: false };
      }

      input.recordRedirectAudit({
        actor,
        action: "redirect.delete",
        summary: `Deleted redirect ${normalizedSourcePath}.`,
        targetId: normalizedSourcePath,
      });

      return { ok: true };
    },
  };
}
