import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const adminPagesRoot = path.resolve(import.meta.dirname, "../pages/ap-admin");
const scriptsRoot = path.resolve(import.meta.dirname, "../../../tooling/scripts");

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

// ---------------------------------------------------------------------------
// ap-stale-tab-warning BroadcastChannel logic
// ---------------------------------------------------------------------------

describe("ap-stale-tab-warning web component", () => {
  it("source file exists and exports ApStaleTabWarning class", () => {
    const wcPath = path.resolve(import.meta.dirname, "../web-components/ap-stale-tab-warning.ts");
    const source = readFileSync(wcPath, "utf8");
    expect(source).toContain("export class ApStaleTabWarning");
    expect(source).toContain("BroadcastChannel");
    expect(source).toContain("astropress-editor");
    expect(source).toContain("customElements.define");
    expect(source).toContain('"ap-stale-tab-warning"');
  });

  it("broadcasts editing message on connectedCallback with unique tab id", () => {
    const wcPath = path.resolve(import.meta.dirname, "../web-components/ap-stale-tab-warning.ts");
    const source = readFileSync(wcPath, "utf8");
    // Must post { type: "editing", slug, id } on connect
    expect(source).toContain('"editing"');
    expect(source).toContain("crypto.randomUUID()");
    // Must post { type: "left", slug, id } on disconnect
    expect(source).toContain('"left"');
    expect(source).toContain("disconnectedCallback");
  });

  it("shows stale-tab warning when another editing message arrives for the same slug", () => {
    const wcPath = path.resolve(import.meta.dirname, "../web-components/ap-stale-tab-warning.ts");
    const source = readFileSync(wcPath, "utf8");
    // Must render a role="alert" warning element
    expect(source).toContain('role", "alert"');
    expect(source).toContain("Another tab is editing this post");
  });

  it("shows stale-session warning when page open time exceeds TTL", () => {
    const wcPath = path.resolve(import.meta.dirname, "../web-components/ap-stale-tab-warning.ts");
    const source = readFileSync(wcPath, "utf8");
    expect(source).toContain("This page has been open over an hour");
    expect(source).toContain("session-ttl-ms");
  });

  it("subpath export exists in package.json", () => {
    const pkgPath = path.resolve(import.meta.dirname, "../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    expect(pkg.exports["./web-components/ap-stale-tab-warning"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Content type custom field auto-generation in post editor
// ---------------------------------------------------------------------------

describe("post editor custom field auto-generation", () => {
  it("post editor uses peekCmsConfig to find registered content types", () => {
    const editorPath = path.resolve(import.meta.dirname, "../pages/ap-admin/posts/[slug].astro");
    const source = readFileSync(editorPath, "utf8");
    expect(source).toContain("peekCmsConfig");
    expect(source).toContain("contentTypes");
    expect(source).toContain("data-ap-custom-fields");
  });

  it("post editor generates text input with metadata. prefix for text fields", () => {
    const editorPath = path.resolve(import.meta.dirname, "../pages/ap-admin/posts/[slug].astro");
    const source = readFileSync(editorPath, "utf8");
    // Input name pattern must be metadata.{field.name}
    expect(source).toContain('`metadata.${field.name}`');
    expect(source).toContain('type="text"');
    expect(source).toContain('type="checkbox"');
  });

  it("post editor generates select inputs for select-type fields", () => {
    const editorPath = path.resolve(import.meta.dirname, "../pages/ap-admin/posts/[slug].astro");
    const source = readFileSync(editorPath, "utf8");
    expect(source).toContain("field.type === \"select\"");
    expect(source).toContain("<select");
  });

  it("post editor marks required fields with asterisk in label", () => {
    const editorPath = path.resolve(import.meta.dirname, "../pages/ap-admin/posts/[slug].astro");
    const source = readFileSync(editorPath, "utf8");
    expect(source).toContain("field.required");
    // Required fields get an asterisk in the label
    expect(source).toContain('" *"');
  });
});
