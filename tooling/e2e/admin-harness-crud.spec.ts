import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

// journey: admin-post-edit-save
// journey: admin-media-upload
// journey: admin-user-invite

async function submitAndWaitForUrl(
  page: Page,
  action: () => Promise<unknown>,
  url: RegExp,
) {
  await Promise.all([
    page.waitForURL(url, { waitUntil: "commit" }),
    action(),
  ]);
  await expect(page).toHaveURL(url);
}

test.describe("Feature: admin CRUD golden path", () => {
  test("Scenario: create post — new post appears in editor after submission", async ({ page }) => {
    const slug = `test-post-${Date.now()}`;
    const title = `Test Post ${Date.now()}`;

    await page.goto("/ap-admin/posts/new", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "New Post" })).toBeVisible();

    await page.locator("input[aria-label='Post title']").fill(title);
    await page.locator("input[aria-label='Slug']").fill(slug);
    await page.locator("input[aria-label='SEO title']").fill(title);
    await page.locator("textarea[aria-label='Meta description']").fill("Test post description.");
    await submitAndWaitForUrl(
      page,
      () => page.getByRole("button", { name: "Create post" }).click(),
      new RegExp(`/ap-admin/posts/${slug}`),
    );
    await expect(page).toHaveURL(new RegExp(`/ap-admin/posts/${slug}`));
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();
  });

  test("Scenario: edit post — save redirects with ?saved=1 success indicator", async ({ page }) => {
    await page.goto("/ap-admin/posts/hello-world", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();

    await page.locator("textarea[aria-label='Body HTML']").fill("<p>Updated body content for CRUD test</p>");
    await submitAndWaitForUrl(
      page,
      () => page.getByRole("button", { name: "Save reviewed changes" }).click(),
      /\/ap-admin\/posts\/hello-world/,
    );
    await expect(page).toHaveURL(/\?saved=1/);
    await expect(page.locator("ap-notice[type='success']")).toBeVisible();
  });

  test("Scenario: publish draft — status changes to published after save", async ({ page }) => {
    await page.goto("/ap-admin/posts/draft-update", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();

    const statusSelect = page.locator("select[aria-label='Publish status']");
    await expect(statusSelect).toHaveValue("draft");

    await statusSelect.selectOption("published");
    await submitAndWaitForUrl(
      page,
      () => page.getByRole("button", { name: "Save reviewed changes" }).click(),
      /\/ap-admin\/posts\/draft-update/,
    );
    await expect(page).toHaveURL(/\?saved=1/);

    // Reload to confirm the status persisted
    await page.goto("/ap-admin/posts/draft-update", { waitUntil: "networkidle" });
    await expect(page.locator("select[aria-label='Publish status']")).toHaveValue("published");

    // Restore back to draft so harness state is consistent on re-runs
    await page.locator("select[aria-label='Publish status']").selectOption("draft");
    await submitAndWaitForUrl(
      page,
      () => page.getByRole("button", { name: "Save reviewed changes" }).click(),
      /\/ap-admin\/posts\/draft-update/,
    );
  });

  test("Scenario: archive post — status set to archived and persists", async ({ page }) => {
    // Create a throwaway post to archive
    const slug = `archive-me-${Date.now()}`;
    await page.goto("/ap-admin/posts/new", { waitUntil: "networkidle" });
    await page.locator("input[aria-label='Post title']").fill("To Be Archived");
    await page.locator("input[aria-label='Slug']").fill(slug);
    await page.locator("input[aria-label='SEO title']").fill("To Be Archived");
    await page.locator("textarea[aria-label='Meta description']").fill("Throwaway post.");
    await submitAndWaitForUrl(
      page,
      () => page.getByRole("button", { name: "Create post" }).click(),
      new RegExp(`/ap-admin/posts/${slug}`),
    );

    // Archive it
    await page.locator("select[aria-label='Publish status']").selectOption("archived");
    await submitAndWaitForUrl(
      page,
      () => page.getByRole("button", { name: "Save reviewed changes" }).click(),
      new RegExp(`/ap-admin/posts/${slug}`),
    );
    await expect(page).toHaveURL(/\?saved=1/);

    // Confirm archived status persisted
    await page.goto(`/ap-admin/posts/${slug}`, { waitUntil: "networkidle" });
    await expect(page.locator("select[aria-label='Publish status']")).toHaveValue("archived");
  });

  test("Scenario: create page — new page appears in editor after submission", async ({ page }) => {
    const path = `/test-page-${Date.now()}`;
    const title = `Test Page ${Date.now()}`;

    await page.goto("/ap-admin/pages/new", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "New Page" })).toBeVisible();

    await page.locator("input[aria-label='Page title']").fill(title);
    await page.locator("input[aria-label='Public path']").fill(path);
    await page.locator("input[aria-label='SEO title']").fill(title);
    await page.locator("textarea[aria-label='Meta description']").fill("Test page description.");
    await submitAndWaitForUrl(
      page,
      () => page.getByRole("button", { name: "Create page" }).click(),
      /\/ap-admin\/route-pages\//,
    );
    await expect(page).toHaveURL(/\?created=1/);
  });
});

test.describe("Feature: admin media upload", () => {
  test("Scenario: upload PNG — asset appears in media library with thumbnail", async ({ page }) => {
    await page.goto("/ap-admin/media", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Media" })).toBeVisible();
    const initialAssetCount = Number((await page.locator(".summary-card strong").first().textContent()) ?? "0");

    // Build a minimal 1×1 PNG in memory using a data URL
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const pngBytes = Buffer.from(pngBase64, "base64");

    // Upload via the hidden file input
    const fileInput = page.locator("input[type='file']").first();
    await fileInput.setInputFiles({
      name: "e2e-test-upload.png",
      mimeType: "image/png",
      buffer: pngBytes,
    });
    await page.locator("input[aria-label='Media title']").fill("E2E Upload");
    await page.locator("input[aria-label='Media alt text']").fill("A 1x1 upload used by the CRUD harness.");
    await submitAndWaitForUrl(
      page,
      () => page.getByRole("button", { name: "Upload media" }).click(),
      /\/ap-admin\/media\?saved=1/,
    );
    await expect(page.getByText("The media library was updated successfully.")).toBeVisible();

    const updatedAssetCount = Number((await page.locator(".summary-card strong").first().textContent()) ?? "0");
    expect(updatedAssetCount).toBeGreaterThan(initialAssetCount);
    await expect(page.getByLabel("Media assets").getByText("E2E Upload")).toBeVisible();

    // A non-empty src thumbnail should appear
    const thumbnails = page.locator("img[src]");
    const count = await thumbnails.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Feature: admin user invite flow", () => {
  test("Scenario: invite user — form submits and success indicator is shown", async ({ page }) => {
    await page.goto("/ap-admin/users", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();

    const emailInput = page.locator("#invite-email");
    await expect(emailInput).toBeVisible();
    await page.locator("#invite-name").fill("E2E Invite");
    await emailInput.fill(`e2e-invite-${Date.now()}@test.local`);
    await page.locator("#invite-role").selectOption("editor");
    await submitAndWaitForUrl(
      page,
      () => page.getByRole("button", { name: "Send Invitation" }).click(),
      /\/ap-admin\/users\?/,
    );
    const successText = page.getByText("The invitation was issued successfully.");
    const previewText = page.getByText(/User created\. Email delivery is in preview mode/i);
    const previewLink = page.getByText(/Invitation link:/i);
    const successVisible = await successText.isVisible().catch(() => false);
    const previewVisible = await previewText.isVisible().catch(() => false);
    const previewLinkVisible = await previewLink.isVisible().catch(() => false);
    expect(successVisible || (previewVisible && previewLinkVisible), "Expected delivered or preview invite feedback after submission").toBe(true);
  });
});
