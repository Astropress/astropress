# Contact Form

Astropress ships a first-party contact-form intake: a public `POST /ap/contact`
endpoint that stores submissions in the runtime content store, where they appear
in the admin under **Forms** (`/ap-admin/forms`). No third-party forms provider
is required for a basic "get in touch" or "request an appointment" form.

## From zero to a working form

### 1. The endpoint is already mounted

`createAstropressAdminAppIntegration()` injects `POST /ap/contact` alongside
`/ap/health`. If your project was scaffolded with `astropress new`, dev mode
(`astro dev`) already serves it — nothing to configure.

It accepts JSON or form-encoded bodies with three required fields:

| Field     | Rules                     |
|-----------|---------------------------|
| `name`    | required, ≤ 200 characters |
| `email`   | required, valid email      |
| `message` | required, ≤ 5000 characters |

Responses: `200 {ok:true}` stored · `400` invalid fields · `403` failed
Turnstile challenge · `429` rate limited (per-IP and per-email windows).

### 2. Put a form on a page

Add this to any page in your site (e.g. `src/pages/contact.astro`):

```html
<form method="post" action="/ap/contact">
  <label for="contact-name">Name</label>
  <input id="contact-name" name="name" required maxlength="200" />

  <label for="contact-email">Email</label>
  <input id="contact-email" name="email" type="email" required />

  <label for="contact-message">Message</label>
  <textarea id="contact-message" name="message" required maxlength="5000"></textarea>

  <!-- Honeypot: keep hidden; bots that fill it are silently dropped -->
  <input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px" />

  <button type="submit">Send</button>
</form>
```

The plain-HTML version above navigates to the JSON response on submit. For an
inline success message, post it with a few lines of JS instead:

```html
<script>
  document.querySelector("form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const response = await fetch("/ap/contact", {
      method: "POST",
      body: new FormData(form),
    });
    const result = await response.json();
    form.outerHTML = result.ok
      ? "<p>Thanks — we'll be in touch.</p>"
      : `<p>${result.error ?? "Your message could not be sent — please try again in a minute."}</p>`;
  });
</script>
```

### 3. Read submissions in the admin

Open **Forms** (`/ap-admin/forms`). Submissions are listed newest-first with
name, email, message, and date. (Requires the `forms:view` capability.)

## Spam protection

Three layers, all on by default:

- **Honeypot** — the hidden `website` field. A non-empty value returns `200`
  without storing anything, so bots can't tell they were caught.
- **Rate limits** — 10/minute per IP, 3 per 10 minutes per email address.
- **Turnstile (optional)** — when Cloudflare Turnstile env vars are configured,
  the endpoint requires a valid challenge token (send it as
  `cf-turnstile-response`). Unconfigured, the check passes — dev and
  self-hosted setups work without it. The admin ships a `TurnstileField.astro`
  component for rendering the widget.

## Static deployments

`POST /ap/contact` needs a server. It works in `astro dev` and on server-output
app hosts (Render Web, Fly.io, Cloudflare, …). On a **fully static** deploy
(GitHub Pages, Netlify static), there is no runtime to receive the POST — use
one of:

- a split deployment: static public site + a small server deployment of the
  admin app that receives `/ap/contact` (see
  [TWO_SITE_DEPLOY](./TWO_SITE_DEPLOY.md)), or
- a hosted forms provider connected under **Forms** in the admin
  (`registerProvider("forms", …)`).

## GDPR

Contact submissions contain personal data (name, email). They are covered by
the erasure tooling documented in [COMPLIANCE](./COMPLIANCE.md).
