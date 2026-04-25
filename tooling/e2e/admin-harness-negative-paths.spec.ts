import { expect, test } from "@playwright/test";

const CSRF_TOKEN = "harness-csrf-token";

// journey: admin-failed-save-feedback
// journey: admin-oversized-upload-feedback
// journey: admin-missing-service-provider
// journey: admin-expired-reset-link
// journey: admin-invalid-admin-action-token
// journey: admin-stale-edit-conflict

function contentSaveForm(
  origin: string,
  lastKnownUpdatedAt: string,
  body: string,
) {
  return {
    _csrf: CSRF_TOKEN,
    slug: "hello-world",
    title: "Hello World",
    status: "published",
    scheduledAt: "",
    body,
    seoTitle: "Hello World",
    metaDescription: "Seeded demo post",
    excerpt: "Seeded demo post",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    canonicalUrlOverride: "",
    robotsDirective: "",
    revisionNote: `Negative-path coverage from ${origin}`,
    lastKnownUpdatedAt,
  };
}

test.describe("Feature: admin negative-path UX", () => {
  test("Scenario: failed post save keeps the editor open with a specific error", async ({ page }) => {
    await page.goto("/ap-admin/posts/hello-world", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();

    await page.locator("input[aria-label='Content title']").fill("");
    await page.getByRole("button", { name: "Save reviewed changes" }).click();

    await page.waitForURL(/\/ap-admin\/posts\/hello-world\?error=1/, {
      waitUntil: "networkidle",
    });
    await expect(page.locator("ap-notice[type='error']")).toContainText(
      "Title, SEO title, and meta description are required.",
    );
  });

  test("Scenario: oversized media upload explains the limit", async ({ page }) => {
    await page.goto("/ap-admin/media", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Media" })).toBeVisible();

    await page.locator("input[type='file']").first().setInputFiles({
      name: "too-large.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 0xff),
    });
    await page.locator("input[aria-label='Media title']").fill("Too Large");
    await page.locator("input[aria-label='Media alt text']").fill("Oversized test file");
    await page.getByRole("button", { name: "Upload media" }).click();

    await page.waitForURL(/\/ap-admin\/media\?error=1/, {
      waitUntil: "networkidle",
    });
    await expect(page.locator(".error-notice")).toContainText("File too large");
    await expect(page.locator(".error-notice")).toContainText("maximum upload size is 10.0 MiB");
  });

  test("Scenario: missing service provider page gives setup guidance", async ({ page }) => {
    const response = await page.goto("/ap-admin/services/not-registered", {
      waitUntil: "networkidle",
    });

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Service not configured" })).toBeVisible();
    await expect(page.getByText("There is no service registered for provider")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Services" })).toBeVisible();
  });

  test("Scenario: expired reset link states that the link is no longer valid", async ({ page }) => {
    await page.goto("/ap-admin/reset-password?token=expired&error=1", {
      waitUntil: "networkidle",
    });

    await expect(page.getByText("That password reset link is invalid or has expired.").first()).toBeVisible();
  });

  test("Scenario: invalid admin action token redirects with a security-token message", async ({ page }) => {
    await page.goto("/ap-admin/posts/hello-world", { waitUntil: "networkidle" });
    const origin = new URL(page.url()).origin;

    const response = await page.request.post("/ap-admin/actions/content-save", {
      headers: { Origin: origin },
      maxRedirects: 0,
      form: {
        ...contentSaveForm(origin, "stale-updated-at", "<p>Invalid token test</p>"),
        _csrf: "expired-token",
      },
    });

    expect(response.status()).toBe(302);
    const location = response.headers().location ?? "";
    expect(location).toContain("/ap-admin/posts?error=1");
    const message = new URL(location, origin).searchParams.get("message");
    expect(message).toBe("Invalid security token");
  });

  test("Scenario: stale post save reports a conflict instead of overwriting", async ({ page }) => {
    await page.goto("/ap-admin/posts/hello-world", { waitUntil: "networkidle" });
    const origin = new URL(page.url()).origin;
    const staleUpdatedAt = await page.locator("input[name='lastKnownUpdatedAt']").inputValue();

    const firstSave = await page.request.post("/ap-admin/actions/content-save", {
      headers: { Origin: origin },
      form: contentSaveForm(origin, staleUpdatedAt, `<p>Conflict seed ${Date.now()}</p>`),
    });
    expect(firstSave.ok()).toBe(true);

    const conflict = await page.request.post("/ap-admin/actions/content-save", {
      headers: { Origin: origin },
      form: contentSaveForm(origin, "1900-01-01 00:00:00", `<p>Stale overwrite ${Date.now()}</p>`),
    });

    expect(conflict.status()).toBe(409);
    expect(await conflict.json()).toEqual({
      error: "This record was modified by another editor after you opened it. Reload to see the latest version.",
      conflict: true,
    });
  });
});
