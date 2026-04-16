import { describe, expect, it } from "vitest";
import { resolveSafeAdminHref } from "../src/admin-link-utils.js";

describe("resolveSafeAdminHref", () => {
  const baseUrl = new URL("https://example.com/ap-admin/users");

  it("returns null for missing or blank values", () => {
    expect(resolveSafeAdminHref(baseUrl, null, ["/ap-admin/accept-invite"])).toBeNull();
    expect(resolveSafeAdminHref(baseUrl, "", ["/ap-admin/accept-invite"])).toBeNull();
    expect(resolveSafeAdminHref(baseUrl, "   ", ["/ap-admin/accept-invite"])).toBeNull();
  });

  it("returns same-origin allowlisted paths as relative hrefs", () => {
    expect(resolveSafeAdminHref(baseUrl, "/ap-admin/accept-invite?token=abc", ["/ap-admin/accept-invite"])).toBe(
      "/ap-admin/accept-invite?token=abc",
    );
  });

  it("returns same-origin allowlisted paths as absolute hrefs", () => {
    expect(
      resolveSafeAdminHref(baseUrl, "https://example.com/ap-admin/reset-password?token=xyz", [
        "/ap-admin/reset-password",
      ]),
    ).toBe("/ap-admin/reset-password?token=xyz");
  });

  it("rejects off-origin and non-allowlisted values", () => {
    expect(resolveSafeAdminHref(baseUrl, "https://evil.example/ap-admin/accept-invite?token=abc", [
      "/ap-admin/accept-invite",
    ])).toBeNull();
    expect(resolveSafeAdminHref(baseUrl, "/ap-admin/other?token=abc", ["/ap-admin/accept-invite"])).toBeNull();
    expect(resolveSafeAdminHref(baseUrl, "javascript:alert(1)", ["/ap-admin/accept-invite"])).toBeNull();
  });
});
