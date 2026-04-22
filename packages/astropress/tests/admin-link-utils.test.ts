import { describe, expect, it } from "vitest";
import { resolveSafeAdminHref } from "../src/admin-link-utils.js";

describe("resolveSafeAdminHref", () => {
  const baseUrl = new URL("https://example.com/ap-admin/users");

  it("returns null for missing, empty, or whitespace-only values", () => {
    expect(resolveSafeAdminHref(baseUrl, null, ["/ap-admin/accept-invite"])).toBeNull();
    expect(resolveSafeAdminHref(baseUrl, "", ["/ap-admin/accept-invite"])).toBeNull();
    expect(resolveSafeAdminHref(baseUrl, "   ", ["/ap-admin/accept-invite"])).toBeNull();
  });

  it("returns null for empty or whitespace-only values even when baseUrl path is allowlisted", () => {
    const baseOnAllowedPath = new URL("https://example.com/ap-admin/accept-invite");
    expect(resolveSafeAdminHref(baseOnAllowedPath, "", ["/ap-admin/accept-invite"])).toBeNull();
    expect(resolveSafeAdminHref(baseOnAllowedPath, "   ", ["/ap-admin/accept-invite"])).toBeNull();
  });

  it("returns a relative href for a same-origin allowlisted relative path", () => {
    expect(
      resolveSafeAdminHref(baseUrl, "/ap-admin/accept-invite?token=abc", ["/ap-admin/accept-invite"]),
    ).toBe("/ap-admin/accept-invite?token=abc");
  });

  it("returns a relative href for a same-origin allowlisted absolute URL", () => {
    expect(
      resolveSafeAdminHref(baseUrl, "https://example.com/ap-admin/reset-password?token=xyz", [
        "/ap-admin/reset-password",
      ]),
    ).toBe("/ap-admin/reset-password?token=xyz");
  });

  it("returns null for a cross-origin URL even if the path is allowlisted", () => {
    expect(
      resolveSafeAdminHref(baseUrl, "https://evil.example/ap-admin/accept-invite?token=abc", [
        "/ap-admin/accept-invite",
      ]),
    ).toBeNull();
  });

  it("returns null for a same-origin URL whose path is not in the allowlist", () => {
    expect(
      resolveSafeAdminHref(baseUrl, "/ap-admin/other?token=abc", ["/ap-admin/accept-invite"]),
    ).toBeNull();
  });

  it("returns null for javascript: URLs", () => {
    expect(resolveSafeAdminHref(baseUrl, "javascript:alert(1)", ["/ap-admin/accept-invite"])).toBeNull();
  });

  it("preserves query params and hash in the returned href", () => {
    expect(
      resolveSafeAdminHref(baseUrl, "/ap-admin/reset-password?token=t&foo=bar#section", [
        "/ap-admin/reset-password",
      ]),
    ).toBe("/ap-admin/reset-password?token=t&foo=bar#section");
  });
});
