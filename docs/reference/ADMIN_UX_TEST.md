# Admin Panel UX Test Plan

Manual testing guide for bringing the admin panel to strong alpha quality.
Run against the admin harness dev server.

## Setup

```bash
bun run --filter astropress-example-admin-harness dev
# Open http://localhost:4325/ap-admin
# Login: admin@example.com / (ADMIN_PASSWORD from .env or harness default)
```

## How to report issues

For each test, note:
- **Pass** — works as expected
- **Friction** — works but feels wrong (slow, confusing, ugly)
- **Bug** — doesn't work or produces an error

Report the route, what you did, and what happened vs what you expected.

---

## Test 1: Post lifecycle

1. Navigate to Posts
2. Click "Create post" (or equivalent)
3. Fill in title, body, slug
4. Save as draft — **check: success message appears**
5. Edit the post — **check: form is pre-filled with saved data**
6. Change the body, save again — **check: success message, data persists on reload**
7. Publish the post — **check: status changes to published**
8. View post revisions — **check: revision history shows changes**
9. Delete the post — **check: confirmation dialog appears before delete**

### Known gaps to watch for
- No loading indicator during save (form submits and redirects)
- No client-side validation on slug format

---

## Test 2: Page creation

1. Navigate to Pages
2. Create a new page with title and content
3. Save — **check: success message, page appears in list**
4. Filter pages by kind — **check: filter works, "Apply filters" button label is clear**
5. Clear filters — **check: empty state message shows if no results**

---

## Test 3: Media management

1. Navigate to Media
2. Upload an image — **check: success message, image appears in grid**
3. **Check: no upload progress indicator exists (known gap)**
4. View the media grid — **check: images load with alt text**
5. Delete a media asset — **check: is there a confirmation dialog? (known missing)**
6. **Check: empty state shows "No media assets yet" with upload CTA when library is empty**

---

## Test 4: Comment moderation

1. Navigate to Comments
2. **Check: empty state "No comments to moderate" shows if no comments**
3. If comments exist: approve one — **check: status changes, success toast appears**
4. Reject one — **check: confirmation dialog appears (styled, not browser alert)**
5. **Check: toast auto-dismisses after ~6 seconds**

---

## Test 5: User management

1. Navigate to Users
2. Invite a new user (enter email) — **check: success message, user appears in list**
3. Suspend a user — **check: confirmation dialog says "Suspend this user?"**
4. Unsuspend — **check: user restored**
5. Issue a password reset link — **check: link displayed or emailed**
6. GDPR purge — **check: strong confirmation dialog (mentions "Cannot be undone")**

### Known gaps to watch for
- Suspend/unsuspend use browser `confirm()` instead of styled dialog
- No loading state on invitation send

---

## Test 6: Settings

1. Navigate to Settings
2. Change site name — save — **check: success message**
3. Navigate tabs (General, Newsletter, Import) — **check: tab switching works**
4. **Check: subscriber table paginates correctly if > 10 entries**
5. Import tab — **check: source cards are visible and actionable**

---

## Test 7: Destructive actions audit

Test each of these for confirmation dialogs:

| Action | Page | Expected |
|--------|------|----------|
| Delete redirect | /ap-admin/redirects | Styled `<dialog>` with Cancel/Delete |
| Reject comment | /ap-admin/comments | Styled `<dialog>` with Cancel/Reject |
| Suspend user | /ap-admin/users | Browser confirm() (known gap — should be styled) |
| Purge user | /ap-admin/users | Browser confirm() with strong warning |
| Delete author | /ap-admin/authors | **Missing — no confirmation (bug)** |
| Delete taxonomy | /ap-admin/taxonomies | **Missing — no confirmation (bug)** |
| Delete media | /ap-admin/media | **Missing — no confirmation (bug)** |
| Delete webhook | /ap-admin/webhooks | **Missing — no confirmation (bug)** |
| Revoke API token | /ap-admin/api-tokens | **Missing — no confirmation (bug)** |

---

## Test 8: Mobile viewport

Resize browser to 375px width (or use device emulation).

1. **Check: sidebar collapses, hamburger menu appears**
2. Open sidebar — **check: it overlays the content, doesn't push it**
3. Navigate to a page — **check: sidebar closes after navigation**
4. **Check: tables scroll horizontally without breaking layout**
5. **Check: all buttons are tappable (at least 44x44px)**
6. Visit /ap-admin/services — **check: service cards stack vertically**

---

## Test 9: Keyboard navigation

1. Press Tab on the dashboard — **check: focus moves to interactive elements**
2. **Check: skip link "Skip to admin content" appears on first Tab**
3. Navigate sidebar with keyboard — **check: aria-current="page" on active item**
4. Open a dialog with keyboard — **check: focus is trapped inside dialog**
5. Press Escape on dialog — **check: dialog closes, focus returns to trigger**

---

## Test 10: Dark mode

1. Click the theme toggle (moon/sun icon in topbar)
2. **Check: all text remains readable, no white-on-white or black-on-black**
3. **Check: form inputs have visible borders**
4. **Check: status badges/chips are still distinguishable**
5. Refresh — **check: theme preference persists**

---

## Test 11: Auth flows

1. Log out and visit /ap-admin — **check: redirects to login**
2. Login with wrong password — **check: error message is specific**
3. Login with correct password — **check: redirects to dashboard**
4. Visit /ap-admin/reset-password — **check: form renders with CSS**
5. Visit /ap-admin/accept-invite?token=demo — **check: renders invitation form**

---

## Test 12: Edge cases

1. Submit a form with empty required fields — **check: browser validation fires**
2. Navigate to a non-existent admin page — **check: 404 page renders**
3. Open two tabs, edit the same post — **check: lock indicator appears**
4. Rapidly click a submit button — **check: no duplicate submissions**

---

## Summary of known issues to fix

From the code-level audit:

| Priority | Issue | Pages affected |
|----------|-------|---------------|
| High | No confirmation on delete for authors, taxonomies, media, webhooks, API tokens | 5 pages |
| High | No loading/disabled state on form submission buttons | All forms |
| Medium | Inconsistent confirmation dialogs (styled `<dialog>` vs browser `confirm()`) | users, subscribers |
| Medium | No file upload progress indicator | media |
| Medium | Missing breadcrumbs on post/archive/route-page editors | 3 pages |
| Low | No client-side field validation display (`.field-error` CSS exists but unused) | All forms |
| Low | CMS/Host iframe panels don't collapse fully on mobile | 2 pages |
