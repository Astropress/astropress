import { test, expect } from "@playwright/test";

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
    await page.getByRole("button", { name: "Create post" }).click();

    await page.waitForURL(new RegExp(`/ap-admin/posts/${slug}`), { waitUntil: "networkidle" });
    await expect(page).toHaveURL(new RegExp(`/ap-admin/posts/${slug}`));
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();
  });

  test("Scenario: edit post — save redirects with ?saved=1 success indicator", async ({ page }) => {
    await page.goto("/ap-admin/posts/hello-world", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();

    await page.locator("textarea[aria-label='Body HTML']").fill("<p>Updated body content for CRUD test</p>");
    await page.getByRole("button", { name: "Save reviewed changes" }).click();

    await page.waitForURL(/\/ap-admin\/posts\/hello-world/, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\?saved=1/);
    await expect(page.locator("ap-notice[type='success']")).toBeVisible();
  });

  test("Scenario: publish draft — status changes to published after save", async ({ page }) => {
    await page.goto("/ap-admin/posts/draft-update", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();

    const statusSelect = page.locator("select[aria-label='Publish status']");
    await expect(statusSelect).toHaveValue("draft");

    await statusSelect.selectOption("published");
    await page.getByRole("button", { name: "Save reviewed changes" }).click();

    await page.waitForURL(/\/ap-admin\/posts\/draft-update/, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\?saved=1/);

    // Reload to confirm the status persisted
    await page.goto("/ap-admin/posts/draft-update", { waitUntil: "networkidle" });
    await expect(page.locator("select[aria-label='Publish status']")).toHaveValue("published");

    // Restore back to draft so harness state is consistent on re-runs
    await page.locator("select[aria-label='Publish status']").selectOption("draft");
    await page.getByRole("button", { name: "Save reviewed changes" }).click();
    await page.waitForURL(/\/ap-admin\/posts\/draft-update/, { waitUntil: "networkidle" });
  });

  test("Scenario: archive post — status set to archived and persists", async ({ page }) => {
    // Create a throwaway post to archive
    const slug = `archive-me-${Date.now()}`;
    await page.goto("/ap-admin/posts/new", { waitUntil: "networkidle" });
    await page.locator("input[aria-label='Post title']").fill("To Be Archived");
    await page.locator("input[aria-label='Slug']").fill(slug);
    await page.locator("input[aria-label='SEO title']").fill("To Be Archived");
    await page.locator("textarea[aria-label='Meta description']").fill("Throwaway post.");
    await page.getByRole("button", { name: "Create post" }).click();
    await page.waitForURL(new RegExp(`/ap-admin/posts/${slug}`), { waitUntil: "networkidle" });

    // Archive it
    await page.locator("select[aria-label='Publish status']").selectOption("archived");
    await page.getByRole("button", { name: "Save reviewed changes" }).click();
    await page.waitForURL(new RegExp(`/ap-admin/posts/${slug}`), { waitUntil: "networkidle" });
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
    await page.getByRole("button", { name: "Create page" }).click();

    await page.waitForURL(/\/ap-admin\/route-pages\//, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\?created=1/);
  });
});

test.describe("Feature: admin media upload", () => {
  test("Scenario: upload PNG — asset appears in media library with thumbnail", async ({ page }) => {
    await page.goto("/ap-admin/media", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Media" })).toBeVisible();

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

    // Wait for the library to update — at least one entry should now be present
    await page.waitForTimeout(800);

    // The uploaded filename should appear somewhere on the page
    await expect(page.getByText("e2e-test-upload.png")).toBeVisible();

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

    // Open the invite dialog / form
    const inviteButton = page.getByRole("button", { name: /invite/i });
    await expect(inviteButton).toBeVisible();
    await inviteButton.click();

    // Fill in the invite email
    const emailInput = page.locator("input[type='email'], input[name='email']").first();
    await expect(emailInput).toBeVisible();
    await emailInput.fill(`e2e-invite-${Date.now()}@test.local`);

    // Select a role if the field is present
    const roleSelect = page.locator("select[name='role']");
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption("editor");
    }

    await page.getByRole("button", { name: /send invite|invite user|submit/i }).click();

    // After submission we expect either a success notice or a preview-mode link
    await page.waitForTimeout(500);
    const successNotice = page.locator("ap-notice[type='success'], [data-testid='invite-success']");
    const previewLink = page.getByText(/preview|accept.*invite/i);
    const hasSuccess = (await successNotice.count()) > 0 || (await previewLink.count()) > 0;
    expect(hasSuccess, "Expected a success notice or preview link after invite submission").toBe(true);
  });
});
