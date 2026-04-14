# Testimonials and Referral Capture

## Two-site topology

Astropress always deploys as two separate sites:

```
Formbricks / Typebot  ──webhook POST──▶  Admin server  (createAstropressAdminAppIntegration)
                                          /ap-api/v1/testimonials/ingest

Public static site  (createAstropressPublicSiteIntegration)
  — has no /ap-api/* routes, never makes browser requests to the admin server
```

The admin server URL goes in the tool's webhook config — it is never embedded in public HTML.

## Quick start

```ts
// cms-registration.ts
registerCms({
  siteUrl: "https://example.com",
  testimonials: {
    type: "formbricks",          // or "typebot"
    url: "https://forms.yourdomain.com",   // optional — embeds tool admin in /ap-admin/services/testimonials
    embedKey: "your-environment-id",       // optional — for widget snippet
    webhookSecret: process.env.FORMBRICKS_WEBHOOK_SECRET,
  },
  // ...
});
```

Then configure a webhook in Formbricks or Typebot pointing to:
```
https://<admin-server>/ap-api/v1/testimonials/ingest
```

## Brain Audit / reverse-testimonial field structure

Astropress stores testimonials using the Alan Weiss reverse-testimonial structure (three-part social proof):

| Field | Description |
|-------|-------------|
| `before_state` | Where was the client before? What was the problem, fear, or challenge? |
| `transformation` | What happened during the engagement? What changed? |
| `specific_result` | What specific, measurable outcome did they achieve? |

Name your survey questions or Typebot variables to match these fields for automatic mapping.

## Formbricks integration

**Survey question headings** that trigger automatic field mapping:

| Heading contains | Maps to |
|-----------------|---------|
| `name` | `name` |
| `email` | `email` |
| `company` | `company` |
| `role` or `title` | `role` |
| `before`, `fear`, `challenge`, or `problem` | `before_state` |
| `transform`, `happen`, or `experience` | `transformation` |
| `result`, `outcome`, or `specific` | `specific_result` |

**Webhook configuration** in Formbricks:
1. Project settings → Webhooks → Add webhook
2. URL: `https://<admin-server>/ap-api/v1/testimonials/ingest`
3. Trigger: `responseFinished`
4. Copy the signing secret → set `FORMBRICKS_WEBHOOK_SECRET`

## Typebot integration

**Variable names** that trigger automatic field mapping:

| Variable name | Maps to |
|--------------|---------|
| `name` or `respondent_name` | `name` |
| `email` or `respondent_email` | `email` |
| `company` | `company` |
| `role` or `job_title` | `role` |
| `before_state`, `before`, or `challenge` | `before_state` |
| `transformation` or `what_happened` | `transformation` |
| `specific_result`, `result`, or `outcome` | `specific_result` |
| `consent` | `consent_to_publish` (any value except `no`/`false` → true) |

**Webhook configuration** in Typebot:
1. Flow settings → Integrations → Webhook
2. URL: `https://<admin-server>/ap-api/v1/testimonials/ingest`
3. Copy the webhook secret → set `TYPEBOT_WEBHOOK_SECRET`

## Referral capture

The same Formbricks survey or Typebot flow can double as a referral form. Use the field mapping creatively:

- `name` — the referrer
- `transformation` — the referred person's name
- `company` — the referred person's contact details

Submissions appear in the Testimonials queue in /ap-admin/testimonials where you can review and moderate them.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FORMBRICKS_WEBHOOK_SECRET` | Production | HMAC-SHA256 key for Formbricks webhook verification |
| `TYPEBOT_WEBHOOK_SECRET` | Production | HMAC-SHA256 key for Typebot webhook verification |
| `FORMBRICKS_URL` | Optional | Self-hosted Formbricks instance URL |
| `TYPEBOT_URL` | Optional | Self-hosted Typebot instance URL |

The webhook secret is optional but **required in production**. Without it the ingest endpoint accepts any POST and a warning is emitted on each request and in `astropress doctor`.
