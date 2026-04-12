# Web Components in Astropress

Astropress ships a set of vanilla custom elements for the admin UI. These elements replace the four original `src/client/*.ts` scripts. They are importable individually, tree-shakeable, usable outside the Astropress package, and extendable via class inheritance.

## Import paths

```ts
// Register all built-in elements (side-effect import)
import "astropress/web-components";

// Or import individual elements (tree-shakeable)
import "astropress/web-components/theme-toggle";
import "astropress/web-components/confirm-dialog";
import "astropress/web-components/html-editor";
import "astropress/web-components/admin-nav";
import "astropress/web-components/ap-stale-tab-warning";
import "astropress/web-components/notice";
```

Each import registers the custom element globally via `customElements.define()`.
Import them in a `<script>` tag inside your `.astro` component.

## Built-in elements

### `<ap-theme-toggle>`

Wraps a button to provide light/dark theme switching. Reads and writes `localStorage` key `"theme"`. Syncs all instances on the page. Responds to `html[data-theme]` via existing CSS variables — no shadow DOM needed.

```html
<ap-theme-toggle label-dark="Switch to dark mode" label-light="Switch to light mode">
  <button type="button" class="theme-toggle-admin" aria-pressed="false">
    <span class="theme-toggle-icon" aria-hidden="true"></span>
  </button>
</ap-theme-toggle>

<script>
  import "astropress/web-components/theme-toggle";
</script>
```

**Attributes (on `<ap-theme-toggle>`):**

| Attribute | Description |
|-----------|-------------|
| `label-dark` | `aria-label` shown when theme is currently light (clicking will go dark) |
| `label-light` | `aria-label` shown when theme is currently dark (clicking will go light) |

**Button child:** The `<button>` must have class `theme-toggle-admin`. The `.theme-toggle-icon` child span receives the ☀/☾ glyph.

---

### `<ap-confirm-dialog>`

A generic confirmation dialog that responds to trigger buttons anywhere on the page. Replaces both `comments-dialog.ts` and `redirects-dialog.ts` with one element.

The `<dialog>` markup lives inside `<ap-confirm-dialog>`. Trigger buttons can live anywhere in the document — they just need to declare `data-confirm-trigger` and `data-dialog-id`.

```html
<!-- The dialog (place near the bottom of your page) -->
<ap-confirm-dialog>
  <dialog id="delete-dialog" class="confirm-modal" aria-labelledby="delete-dialog-title">
    <div class="modal-content">
      <h2 id="delete-dialog-title">Delete item?</h2>
      <p>This action cannot be undone.</p>
      <p><strong id="item-name"></strong></p>
      <div class="modal-actions">
        <button type="button" data-dialog-close>Cancel</button>
        <form method="post" action="/ap-admin/actions/item-delete">
          <input type="hidden" name="itemId" value="" />
          <button type="submit">Delete</button>
        </form>
      </div>
    </div>
  </dialog>
</ap-confirm-dialog>

<!-- The trigger (can be anywhere on the page) -->
<button
  type="button"
  data-confirm-trigger
  data-dialog-id="delete-dialog"
  data-text-item-name="My Item"
  data-field-name="itemId"
  data-field-value="abc-123"
>
  Delete
</button>

<script>
  import "astropress/web-components/confirm-dialog";
</script>
```

**Trigger attributes (on the button that opens the dialog):**

| Attribute | Description |
|-----------|-------------|
| `data-confirm-trigger` | Marks this button as a dialog trigger |
| `data-dialog-id` | ID of the `<dialog>` to open |
| `data-text-[element-id]` | Sets `textContent` on `#[element-id]` inside the dialog |
| `data-field-name` | Name of the `<input>` to populate inside the dialog's form |
| `data-field-value` | Value to set on that input |

**Close triggers (inside `<ap-confirm-dialog>`):** Any element with `data-dialog-close` closes the dialog when clicked.

---

### `<ap-html-editor>`

Wraps a textarea editor with a formatting toolbar, live preview iframe, media library dialog, and a URL input dialog. Replaces `post-editor.ts` and eliminates `window.prompt()` for link insertion.

```html
<ap-html-editor>
  <form method="post" action="/ap-admin/actions/content-save">
    <div role="toolbar" aria-label="Format body">
      <button type="button" data-cmd="bold" aria-label="Bold"><strong>B</strong></button>
      <button type="button" data-cmd="italic" aria-label="Italic"><em>I</em></button>
      <button type="button" data-cmd="insertUnorderedList" aria-label="Bullet list">List</button>
      <button type="button" data-cmd="createLink" aria-label="Insert link">Link</button>
      <button type="button" class="insert-media-btn" aria-label="Open media library">Media</button>
    </div>
    <textarea data-body-editor name="body" rows="14"></textarea>
    <div class="preview-frame">
      <iframe sandbox="" title="Rendered preview"></iframe>
    </div>
    <!-- ... other form fields ... -->
  </form>

  <!-- URL input dialog — place outside the form to avoid nested-form issues -->
  <dialog id="url-input-dialog" aria-labelledby="url-input-title">
    <h2 id="url-input-title">Insert link</h2>
    <form id="url-input-form" method="dialog">
      <input id="url-input-field" type="url" name="url" placeholder="https://" />
      <button type="button" data-dialog-close>Cancel</button>
      <button type="submit">Insert link</button>
    </form>
  </dialog>

  <!-- Media library dialog -->
  <dialog id="media-library-dialog" aria-labelledby="media-dialog-title">
    <h2 id="media-dialog-title">Media Library</h2>
    <!-- ... media content ... -->
    <button id="media-dialog-close" type="button">Close</button>
  </dialog>
</ap-html-editor>

<script>
  import "astropress/web-components/html-editor";
</script>
```

**Expected descendants (queried by `this.querySelector`):**

| Selector | Role |
|----------|------|
| `[data-body-editor]` | The `<textarea>` to edit |
| `.preview-frame iframe` | The `<iframe sandbox="">` for live preview |
| `[role="toolbar"][aria-label="Format body"]` | The formatting toolbar |
| `.insert-media-btn` | Button that opens the media library |
| `#media-library-dialog` | The media picker `<dialog>` |
| `#media-dialog-close` | Close button inside the media dialog |
| `#url-input-dialog` | `<dialog>` for URL input (replaces `window.prompt`) |
| `#url-input-field` | `<input>` inside the URL dialog |
| `#url-input-form` | `<form method="dialog">` inside the URL dialog |

**Toolbar `data-cmd` values:** `bold`, `italic`, `insertUnorderedList`, `createLink`

**Important:** Place dialog elements as siblings of the main `<form>`, not inside it. HTML does not allow nested `<form>` elements — the inner form would be dropped by the parser.

---

### `<ap-admin-nav>`

The sidebar navigation element. Highlights the current page using
`aria-current="page"` and supports keyboard navigation between links.

```html
<ap-admin-nav>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/ap-admin" aria-current="page">Dashboard</a></li>
      <li><a href="/ap-admin/posts">Posts</a></li>
      <li><a href="/ap-admin/media">Media</a></li>
    </ul>
  </nav>
</ap-admin-nav>

<script>
  import "astropress/web-components/admin-nav";
</script>
```

The component derives `aria-current` from `window.location.pathname` — no
attribute needed; the server can render without knowing the current path.

---

### `<ap-stale-tab-warning>`

Shows an accessible warning banner when another browser tab is editing the
same content, or when the page has been open longer than the session TTL.

Uses the [`BroadcastChannel` API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)
— cross-tab communication with no server round-trips.

```html
<ap-stale-tab-warning
  slug="my-post-slug"
  session-ttl-ms="3600000"
>
</ap-stale-tab-warning>

<script>
  import "astropress/web-components/ap-stale-tab-warning";
</script>
```

**Attributes:**

| Attribute | Default | Description |
|-----------|---------|-------------|
| `slug` | — | Identifies the content being edited (should match `pageRecord.slug`) |
| `session-ttl-ms` | `3600000` (1 hr) | Shows a reload warning after this many ms without a page refresh |

When triggered, the element renders a `role="alert"` banner — screen readers
announce it immediately without focus change.

---

### `<ap-notice>`

A transient notification banner with an accessible live region. Use it
to announce save confirmations, warnings, or status changes.

```html
<ap-notice dismiss-after="4000">Post saved.</ap-notice>

<script>
  import "astropress/web-components/notice";
</script>
```

**Attributes:**

| Attribute | Default | Description |
|-----------|---------|-------------|
| `dismiss-after` | — | Removes the element after this many milliseconds |

The element renders with `role="status"` and `aria-live="polite"` — screen
readers announce the message when it appears, without interrupting the user.
Omit `dismiss-after` for a persistent notice.

Create notices dynamically:

```ts
const notice = document.createElement("ap-notice");
notice.setAttribute("dismiss-after", "3000");
notice.textContent = "Saved!";
document.body.appendChild(notice);
```

---

## Design principles

### Light DOM (not shadow DOM)

All three elements use light DOM. The admin UI CSS lives in `AdminLayout.astro` as CSS Custom Properties (`--bg`, `--accent`, `--text`, etc.). Shadow DOM would isolate element internals from these variables, requiring `::part()` selectors everywhere. Light DOM inherits the existing tokens without any extra ceremony.

### Progressive enhancement

Astro server-renders semantic HTML for all admin pages. Each WC upgrades the HTML on the client. If JavaScript is blocked or slow, the forms still exist and submit correctly; the WC just adds the interactive layer.

### Attribute-driven state

The server passes initial state via HTML attributes. The WC owns all client-side interactivity after upgrade. This keeps the Astro template simple and the WC self-contained.

### AbortController for cleanup

Each WC stores an `AbortController` in `connectedCallback` and calls `.abort()` in `disconnectedCallback`. This removes all event listeners in one call without tracking them individually.

---

## Extending a built-in element

```ts
import { ApConfirmDialog } from "astropress/web-components/confirm-dialog";

class MyConfirmDialog extends ApConfirmDialog {
  connectedCallback() {
    super.connectedCallback();
    // Add custom behavior here
  }
}

customElements.define("my-confirm-dialog", MyConfirmDialog);
```

Use `my-confirm-dialog` in your templates instead of `ap-confirm-dialog`.

---

## Writing a new element

Follow the same conventions as the built-in elements:

```ts
export class ApMyElement extends HTMLElement {
  private _abortController: AbortController | null = null;

  connectedCallback() {
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    // Wire up event listeners using { signal } so they're removed automatically
    this.querySelector("button")?.addEventListener("click", () => {
      // handle click
    }, { signal });
  }

  disconnectedCallback() {
    this._abortController?.abort();
    this._abortController = null;
  }
}

customElements.define("ap-my-element", ApMyElement);
```

Key rules:
- Light DOM only — no `attachShadow()`
- Use `this.querySelector()` to find descendants (not `document.querySelector()`)
- Pass `{ signal }` to every `addEventListener` call
- Export the class so consumers can extend it
- Register with a `ap-` prefix (astropress namespace)

---

## Testing

WC tests live in `packages/astropress/tests/web-components/`. They use Vitest with jsdom via the `// @vitest-environment jsdom` file annotation.

jsdom stubs required:
- `window.matchMedia` — not implemented in jsdom; stub with `vi.fn()`
- `HTMLDialogElement.showModal` / `.close` — not implemented in jsdom; add per-dialog stubs in test helpers

Run:
```bash
bun run test
```

---

## Screen Reader Usage

The Astropress admin panel is designed to be fully navigable with screen readers. This section documents how to navigate key areas.

### Navigation and landmarks

The admin UI uses semantic HTML landmarks:
- `<header>` — top bar with site title and user menu
- `<nav aria-label="Main navigation">` — sidebar navigation (`<ap-admin-nav>`)
- `<main>` — page content area
- `<footer>` — bottom bar (if present)

Use your screen reader's landmark navigation shortcut to jump between these areas:
- **NVDA/JAWS:** `D` (next landmark) or `Shift+D` (previous)
- **VoiceOver (macOS):** `VO+U` (rotor) → Landmarks
- **TalkBack (Android):** Swipe with two fingers

### Page headings

Each admin page has a structured heading hierarchy:
- `<h1>` — page title (e.g., "Posts", "Media Library", "Settings")
- `<h2>` — section titles within the page
- `<h3>` — sub-sections or component headings

Use heading navigation to jump to sections:
- **NVDA:** `H` (next heading), `1`–`6` (heading level)
- **VoiceOver:** `VO+Command+H`

### Forms and inputs

All form controls have explicit `<label>` elements or `aria-label` attributes. Required fields are marked with `*` in the visible label and `aria-required="true"` on the input.

Error messages are associated with their inputs via `aria-describedby` and will be announced automatically when focus moves to an invalid field.

### Dialogs

The `<ap-confirm-dialog>` component uses the native `<dialog>` element:
- Focus moves into the dialog when it opens
- `Escape` closes the dialog and returns focus to the trigger element
- The dialog has `aria-labelledby` pointing to its heading

### Theme toggle

`<ap-theme-toggle>` is a `role="switch"` button with `aria-checked` indicating the current theme. Activating it announces "Dark mode on" or "Dark mode off".

### Rich text editor

`<ap-html-editor>` wraps a `<textarea>` with a toolbar. The toolbar buttons have `aria-label` attributes. The textarea announces character counts when available. Use `Tab` to move from the toolbar to the textarea.

### `<ap-stale-tab-warning>`

When multiple tabs are editing the same content, a warning banner appears with `role="alert"`. Screen readers will announce the warning message automatically when it appears.

### Skip link

A visually-hidden skip link (`<a class="skip-link" href="#main-content">Skip to main content</a>`) appears at the top of every admin page. It becomes visible on keyboard focus. Activating it moves keyboard focus past the navigation to the main content area.
