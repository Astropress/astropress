/**
 * System honesty invariant tests
 *
 * These structural tests enforce that Astropress never tells the user an
 * operation succeeded when it hasn't — a set of "don't lie" guarantees.
 *
 * Honesty invariants enforced here:
 *   H1. EmailResult always has a `delivered` field; it is true only when
 *       Resend confirmed delivery.
 *   H2. Success-redirect params (?saved=1, ?scheduled=1, ?ok=1) appear only
 *       after a successful-result check in action handlers.
 *   H3. schedule-publish reads the content state before confirming
 *       `?scheduled=1` — prevents phantom schedule confirmations.
 *   H4. `delivered: true` appears only in the Resend HTTP-200 success branch
 *       of transactional-email.ts.
 *   H5. releaseLock returns a boolean (or Promise<boolean>), not void — callers
 *       can inspect the result rather than assuming success.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = path.resolve(import.meta.dirname, "../src");
const actionsRoot = path.resolve(import.meta.dirname, "../pages/ap-admin/actions");

function readSource(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function listFiles(root: string, ext: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(root)) {
    const full = path.join(root, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...listFiles(full, ext));
    } else if (full.endsWith(ext)) {
      results.push(full);
    }
  }
  return results.sort();
}

// ---------------------------------------------------------------------------
// H1 — EmailResult has a `delivered` boolean field
// ---------------------------------------------------------------------------

describe("H1: EmailResult has a delivered field", () => {
  it("transactional-email.ts defines `delivered: boolean` on EmailResult", () => {
    const src = readSource(path.join(srcRoot, "transactional-email.ts"));
    // The interface must declare `delivered: boolean`
    expect(src).toMatch(/delivered:\s*boolean/);
  });

  it("transactional-email.ts EmailResult interface includes both ok and delivered", () => {
    const src = readSource(path.join(srcRoot, "transactional-email.ts"));
    expect(src).toMatch(/interface EmailResult/);
    expect(src).toMatch(/ok:\s*boolean/);
    expect(src).toMatch(/delivered:\s*boolean/);
  });
});

// ---------------------------------------------------------------------------
// H2 — ?saved=1 / ?scheduled=1 / ?ok=1 redirects follow a success check
// ---------------------------------------------------------------------------

describe("H2: success-redirect params only appear after success checks", () => {
  const SUCCESS_PARAMS = ["?saved=1", "?scheduled=1", "?ok=1"];

  it("every action file containing a success redirect also contains a fail/error guard", () => {
    const actionFiles = listFiles(actionsRoot, ".ts");
    const violations: string[] = [];

    for (const file of actionFiles) {
      const src = readSource(file);
      const hasSuccessRedirect = SUCCESS_PARAMS.some((param) => src.includes(param));
      if (!hasSuccessRedirect) continue;

      // Must also have a failure path (fail(), return fail, or early return before the redirect)
      const hasFail = src.includes("fail(") || src.includes("return fail") || src.includes("fail(\"");
      const hasGuard = hasFail
        || src.includes("if (!") // early-return guard pattern
        || src.includes("withAdminFormAction") // withAdminFormAction wraps fail
        || src.includes("requireAdminFormAction");

      if (!hasGuard) {
        violations.push(path.basename(file));
      }
    }

    expect(violations, `Action files with success redirects but no failure guards: ${violations.join(", ")}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// H3 — schedule-publish reads content state before confirming ?scheduled=1
// ---------------------------------------------------------------------------

describe("H3: schedule-publish validates content exists before scheduling", () => {
  it("schedule-publish.ts calls getContentState before the ?scheduled=1 redirect", () => {
    const src = readSource(path.join(actionsRoot, "schedule-publish.ts"));

    // Both calls must exist
    expect(src, "must call getContentState to verify content exists").toMatch(/getContentState\(/);
    expect(src, "must redirect to ?scheduled=1 on success").toMatch(/\?scheduled=1/);

    // getContentState must appear before the redirect
    const getContentStatePos = src.indexOf("getContentState(");
    const scheduledRedirectPos = src.indexOf("?scheduled=1");
    expect(getContentStatePos, "getContentState must precede ?scheduled=1 redirect")
      .toBeLessThan(scheduledRedirectPos);
  });

  it("schedule-publish.ts returns early when content is not found", () => {
    const src = readSource(path.join(actionsRoot, "schedule-publish.ts"));
    // Must fail if existing is falsy — prevents phantom confirmations
    expect(src).toMatch(/if\s*\(!existing\)/);
  });
});

// ---------------------------------------------------------------------------
// H4 — `delivered: true` only in the Resend HTTP-200 success branch
// ---------------------------------------------------------------------------

describe("H4: delivered: true set only in Resend success branch", () => {
  it("transactional-email.ts has exactly one `delivered: true` — in the Resend 200 branch", () => {
    const src = readSource(path.join(srcRoot, "transactional-email.ts"));

    // Count occurrences of `delivered: true`
    const matches = [...src.matchAll(/delivered:\s*true/g)];
    expect(matches.length).toBe(1);

    // That one occurrence must be preceded by `response.ok` check (the Resend success branch)
    const deliveredTruePos = src.indexOf("delivered: true");
    const responseOkPos = src.lastIndexOf("response.ok", deliveredTruePos);
    expect(responseOkPos, "delivered: true must be inside the response.ok success branch")
      .toBeGreaterThan(-1);
  });

  it("non-Resend code paths set delivered: false", () => {
    const src = readSource(path.join(srcRoot, "transactional-email.ts"));
    // mock-mode path and error paths all use `delivered: false`
    const falseCounts = [...src.matchAll(/delivered:\s*false/g)].length;
    expect(falseCounts).toBeGreaterThanOrEqual(3); // mock, error, unconfigured
  });
});

// ---------------------------------------------------------------------------
// H5 — releaseLock returns boolean (not void)
// ---------------------------------------------------------------------------

describe("H5: releaseLock returns boolean, not void", () => {
  it("sqlite locks releaseLock returns boolean (not void)", () => {
    const src = readSource(path.join(srcRoot, "sqlite-runtime/locks.ts"));
    // Must declare return type boolean or Promise<boolean>
    expect(src).toMatch(/releaseLock[^:]*:[^{]*boolean/);
    // Must NOT use void return type for releaseLock
    expect(src).not.toMatch(/releaseLock[^:]*:[^{]*void/);
  });

  it("d1 locks releaseLock returns Promise<boolean> (not void)", () => {
    const src = readSource(path.join(srcRoot, "d1-locks.ts"));
    expect(src).toMatch(/releaseLock[^:]*:[^{]*Promise<boolean>/);
    expect(src).not.toMatch(/releaseLock[^:]*:[^{]*Promise<void>/);
  });
});
