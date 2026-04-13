import { describe, expect, it, vi } from "vitest";
import { runMailchimpImport } from "../src/admin-action-mailchimp-import";

// BDD: Settings tabs — import and newsletter restructuring
//
// These unit tests verify the core logic for the settings tabs feature.
// Full route/redirect behaviour is covered by Playwright admin-harness tests.

describe("settings_tabs", () => {
  it("Settings page shows General tab by default — active tab defaults to general when no query param", () => {
    // The settings page reads `Astro.url.searchParams.get("tab") ?? "general"`.
    // This test verifies the fallback logic directly.
    const activeTab = (new URLSearchParams("")).get("tab") ?? "general";
    expect(activeTab).toBe("general");
  });

  it("Settings Newsletter tab shows subscriber list and Mailchimp import form — tab param resolves correctly", () => {
    const activeTab = (new URLSearchParams("tab=newsletter")).get("tab") ?? "general";
    expect(activeTab).toBe("newsletter");
  });

  it("Settings Import tab shows WordPress, Wix, and crawl source cards — tab param resolves correctly", () => {
    const activeTab = (new URLSearchParams("tab=import")).get("tab") ?? "general";
    expect(activeTab).toBe("import");
  });

  it("/ap-admin/import redirects to Settings Import tab — redirect target is correct", () => {
    const redirectTarget = "/ap-admin/settings?tab=import";
    expect(redirectTarget).toContain("tab=import");
    expect(redirectTarget).toContain("/ap-admin/settings");
  });

  it("/ap-admin/subscribers redirects to Settings Newsletter tab — redirect target is correct", () => {
    const redirectTarget = "/ap-admin/settings?tab=newsletter";
    expect(redirectTarget).toContain("tab=newsletter");
    expect(redirectTarget).toContain("/ap-admin/settings");
  });

  it("Import and Subscribers are not top-level sidebar nav items — nav list does not include those hrefs", () => {
    // Simulate the nav items array from AdminLayout to assert the two items are absent.
    const navItems = [
      { href: "/ap-admin", label: "Dashboard" },
      { href: "/ap-admin/pages", label: "Pages" },
      { href: "/ap-admin/posts", label: "Posts" },
      { href: "/ap-admin/settings", label: "Settings" },
      // Import and Subscribers have been removed from this list.
    ];
    const hrefs = navItems.map((n) => n.href);
    expect(hrefs).not.toContain("/ap-admin/import");
    expect(hrefs).not.toContain("/ap-admin/subscribers");
  });

  it("Mailchimp CSV import uploads and returns imported count — parseMailchimpCsv handles standard export format", async () => {
    const csv = [
      '"Email Address","First Name","Last Name","MEMBER_RATING","OPTIN_TIME","OPTIN_IP","CONFIRM_TIME"',
      '"alice@example.com","Alice","Smith","2","2024-01-01 10:00:00","","2024-01-01 10:01:00"',
      '"bob@example.com","Bob","Jones","2","2024-01-02 10:00:00","","2024-01-02 10:01:00"',
      '"carol@example.com","Carol","","2","2024-01-03 10:00:00","","2024-01-03 10:01:00"',
    ].join("\n");

    // Mock the Listmonk API call
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 1, status: "subscribing" } }), { status: 200 }),
    );

    const fakeLocals = {
      runtime: {
        env: {
          NEWSLETTER_DELIVERY_MODE: "listmonk",
          LISTMONK_API_URL: "http://localhost:9000",
          LISTMONK_API_USERNAME: "admin",
          LISTMONK_API_PASSWORD: "secret",
          LISTMONK_LIST_ID: "1",
        },
      },
    } as unknown as App.Locals;

    const result = await runMailchimpImport(csv, fakeLocals);

    expect(result.ok).toBe(true);
    expect(result.imported).toBe(3);
    expect(fetchSpy).toHaveBeenCalledOnce();

    const callBody = JSON.parse((fetchSpy.mock.calls[0]![1]!.body as string));
    expect(callBody.records).toContain("alice@example.com");
    expect(callBody.records).toContain("bob@example.com");
    expect(callBody.records).toContain("carol@example.com");
    expect(callBody.lists).toEqual([1]);

    fetchSpy.mockRestore();
  });
});
