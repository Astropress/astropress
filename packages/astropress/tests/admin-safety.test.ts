import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const adminPagesRoot = path.resolve(import.meta.dirname, "../pages/ap-admin");
const scriptsRoot = path.resolve(import.meta.dirname, "../../../scripts");

function listAstroFiles(root: string, files: string[] = []) {
  for (const entry of readdirSync(root)) {
    const fullPath = path.join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      listAstroFiles(fullPath, files);
      continue;
    }
    if (fullPath.endsWith(".astro")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

describe("admin markup safety", () => {
  it("does not ship inline event handler attributes in admin templates", () => {
    for (const astroFile of listAstroFiles(adminPagesRoot)) {
      const source = readFileSync(astroFile, "utf8");
      expect(source).not.toMatch(/\son[a-z]+=/);
    }
  });

  it("does not use contenteditable in admin templates", () => {
    for (const astroFile of listAstroFiles(adminPagesRoot)) {
      const source = readFileSync(astroFile, "utf8");
      expect(source).not.toContain("contenteditable=");
    }
  });

  it("labels admin dialogs accessibly and previews rich HTML inside a sandboxed iframe", () => {
    const commentsPage = readFileSync(path.join(adminPagesRoot, "comments.astro"), "utf8");
    const redirectsPage = readFileSync(path.join(adminPagesRoot, "redirects.astro"), "utf8");
    const postEditorPage = readFileSync(path.join(adminPagesRoot, "posts/[slug].astro"), "utf8");

    expect(commentsPage).toContain('<dialog id="reject-dialog" class="confirm-modal" aria-labelledby="reject-dialog-title">');
    expect(redirectsPage).toContain('<dialog id="confirm-dialog" class="confirm-modal" aria-labelledby="confirm-dialog-title">');
    expect(postEditorPage).toContain("<iframe");
    expect(postEditorPage).toContain('sandbox=""');
    expect(postEditorPage).not.toContain("set:html={pageRecord.body}");
  });

  it("does not suppress color-contrast in any axe audit script", () => {
    const auditScripts = readdirSync(scriptsRoot).filter((f) => f.endsWith(".ts"));
    for (const script of auditScripts) {
      const src = readFileSync(path.join(scriptsRoot, script), "utf8");
      expect(src, `${script} must not suppress color-contrast`).not.toContain('disableRules(["color-contrast"])');
      expect(src, `${script} must not suppress color-contrast`).not.toContain("disableRules(['color-contrast'])");
    }
  });

  it("keeps core auth/admin accessibility affordances in place", () => {
    const adminLayout = readFileSync(path.resolve(import.meta.dirname, "../components/AdminLayout.astro"), "utf8");
    const loginPage = readFileSync(path.join(adminPagesRoot, "login.astro"), "utf8");
    const invitePage = readFileSync(path.join(adminPagesRoot, "accept-invite.astro"), "utf8");
    const resetPage = readFileSync(path.join(adminPagesRoot, "reset-password.astro"), "utf8");

    expect(adminLayout).toContain('class="skip-link"');
    expect(adminLayout).toContain('aria-label="Admin sections"');
    expect(loginPage).toContain('<input type="email" name="email" autocomplete="email" required />');
    expect(loginPage).toContain('<input type="password" name="password" autocomplete="current-password" required />');
    expect(invitePage).toContain('<input type="password" name="password" autocomplete="new-password" minlength="12" required />');
    expect(invitePage).toContain('<input type="password" name="confirmPassword" autocomplete="new-password" minlength="12" required />');
    expect(resetPage).toContain('<input type="email" name="email" autocomplete="email" required />');
    expect(resetPage).toContain('<input type="password" name="password" autocomplete="new-password" minlength="12" required />');
  });
});
