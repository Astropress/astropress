import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeLocals } from "./helpers/make-locals.js";
import { makeDb, STANDARD_ACTOR, STANDARD_CMS_CONFIG } from "./helpers/make-db.js";

let createRuntimeRedirectRule: typeof import("../src/runtime-actions-misc.js").createRuntimeRedirectRule;
let deleteRuntimeRedirectRule: typeof import("../src/runtime-actions-misc.js").deleteRuntimeRedirectRule;
let moderateRuntimeComment: typeof import("../src/runtime-actions-misc.js").moderateRuntimeComment;
let saveRuntimeSettings: typeof import("../src/runtime-actions-misc.js").saveRuntimeSettings;
let updateRuntimeTranslationState: typeof import("../src/runtime-actions-misc.js").updateRuntimeTranslationState;
let registerCms: typeof import("../src/config.js").registerCms;

const actor = STANDARD_ACTOR;

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(async () => {
  vi.resetModules();
  vi.doUnmock("../src/local-runtime-modules");
  vi.doUnmock("../src/local-runtime-modules.js");

  ([{ createRuntimeRedirectRule, deleteRuntimeRedirectRule, moderateRuntimeComment, saveRuntimeSettings, updateRuntimeTranslationState }, { registerCms }] =
    await Promise.all([import("../src/runtime-actions-misc.js"), import("../src/config.js")]));

  db = makeDb();
  locals = makeLocals(db);
  registerCms(STANDARD_CMS_CONFIG);

  db.prepare("INSERT INTO redirect_rules (source_path, target_path, status_code, created_by) VALUES (?, ?, ?, ?)").run("/existing", "/dest", 301, "admin@test.local");
  db.prepare("INSERT INTO comments (id, route, author, body, status) VALUES (?, ?, ?, ?, ?)").run("c-1", "/page", "Bob", "Hello", "pending");
});

afterAll(() => {
  vi.resetModules();
});

describe("updateRuntimeTranslationState", () => {
  it("persists a valid state", async () => {
    const result = await updateRuntimeTranslationState("/about", "translated", actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT state FROM translation_overrides WHERE route = ?").get("/about") as { state: string };
    expect(row.state).toBe("translated");
  });

  it("rejects an invalid state", async () => {
    const result = await updateRuntimeTranslationState("/about", "bogus", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("upserts on second call for same route", async () => {
    await updateRuntimeTranslationState("/about", "partial", actor, locals);
    await updateRuntimeTranslationState("/about", "translated", actor, locals);
    const row = db.prepare("SELECT state FROM translation_overrides WHERE route = ?").get("/about") as { state: string };
    expect(row.state).toBe("translated");
  });
});

describe("createRuntimeRedirectRule", () => {
  it("creates a redirect", async () => {
    const result = await createRuntimeRedirectRule({ sourcePath: "/from", targetPath: "/to", statusCode: 301 }, actor, locals);
    expect(result).toMatchObject({ ok: true, rule: { sourcePath: "/from", targetPath: "/to", statusCode: 301 } });
  });

  it("rejects same source and target", async () => {
    const result = await createRuntimeRedirectRule({ sourcePath: "/same", targetPath: "/same", statusCode: 301 }, actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects empty source path", async () => {
    const result = await createRuntimeRedirectRule({ sourcePath: "   ", targetPath: "/to", statusCode: 301 }, actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects protocol-relative path (open redirect guard)", async () => {
    const result = await createRuntimeRedirectRule({ sourcePath: "//evil.example/x", targetPath: "/safe", statusCode: 301 }, actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects duplicate active rule", async () => {
    const result = await createRuntimeRedirectRule({ sourcePath: "/existing", targetPath: "/other", statusCode: 301 }, actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("normalises 302 and defaults others to 301", async () => {
    const r = await createRuntimeRedirectRule({ sourcePath: "/a", targetPath: "/b", statusCode: 302 }, actor, locals);
    expect(r).toMatchObject({ ok: true, rule: { statusCode: 302 } });
    const r2 = await createRuntimeRedirectRule({ sourcePath: "/c", targetPath: "/d", statusCode: 303 }, actor, locals);
    expect(r2).toMatchObject({ ok: true, rule: { statusCode: 301 } });
  });
});

describe("deleteRuntimeRedirectRule", () => {
  it("soft-deletes an active rule", async () => {
    const result = await deleteRuntimeRedirectRule("/existing", actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT deleted_at FROM redirect_rules WHERE source_path = '/existing'").get() as { deleted_at: string | null };
    expect(row.deleted_at).not.toBeNull();
  });

  it("returns not-ok for non-existent path", async () => {
    const result = await deleteRuntimeRedirectRule("/ghost", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });
});

describe("moderateRuntimeComment", () => {
  it("approves a pending comment", async () => {
    const result = await moderateRuntimeComment("c-1", "approved", actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT status FROM comments WHERE id = 'c-1'").get() as { status: string };
    expect(row.status).toBe("approved");
  });

  it("rejects a pending comment", async () => {
    await moderateRuntimeComment("c-1", "rejected", actor, locals);
    const row = db.prepare("SELECT status FROM comments WHERE id = 'c-1'").get() as { status: string };
    expect(row.status).toBe("rejected");
  });

  it("returns not-ok for unknown comment id", async () => {
    const result = await moderateRuntimeComment("ghost", "approved", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });
});

describe("no-db fallback (null locals)", () => {
  it("updateRuntimeTranslationState throws without runtime alias", async () => {
    await expect(updateRuntimeTranslationState("/about", "needs-review", actor, null)).rejects.toThrow(
      "Local runtime modules are only available",
    );
  });

  it("saveRuntimeSettings throws without runtime alias", async () => {
    await expect(saveRuntimeSettings({ siteTitle: "Local" }, actor, null)).rejects.toThrow(
      "Local runtime modules are only available",
    );
  });

  it("createRuntimeRedirectRule throws without runtime alias", async () => {
    await expect(
      createRuntimeRedirectRule({ sourcePath: "/local", targetPath: "/dest", statusCode: 301 }, actor, null),
    ).rejects.toThrow("Local runtime modules are only available");
  });
});

describe("saveRuntimeSettings", () => {
  it("creates settings when none exist", async () => {
    const result = await saveRuntimeSettings({ siteTitle: "My Blog" }, actor, locals);
    expect(result).toMatchObject({ ok: true });
    expect((result as { settings: { siteTitle: string } }).settings.siteTitle).toBe("My Blog");
  });

  it("partial update preserves other fields", async () => {
    await saveRuntimeSettings({ siteTitle: "Original", siteTagline: "Tag" }, actor, locals);
    await saveRuntimeSettings({ siteTitle: "Updated" }, actor, locals);
    const row = db.prepare("SELECT site_title, site_tagline FROM site_settings WHERE id = 1").get() as { site_title: string; site_tagline: string };
    expect(row.site_title).toBe("Updated");
    expect(row.site_tagline).toBe("Tag");
  });
});
