---
name: Integration request (external tool)
about: Request a new external integration — analytics, email, A/B testing, donations, webhooks
title: "[Integration] "
labels: integration, enhancement
assignees: ""
---

> **Not an integration?** For new *hosting providers or data services* (Cloudflare, Turso, Neon, Vercel, etc.) use the [adapter request template](?template=adapter_support.md). For brand-new framework capabilities use the [feature request template](?template=feature_request.md).

## Tool details

| Field | Value |
|-------|-------|
| Integration name | <!-- e.g. Plausible Analytics, Resend, GrowthBook --> |
| Integration domain | <!-- analytics / newsletter / ab-testing / monitoring / forms / cdn-purge / search / deploy-hooks --> |
| Official Node/Edge SDK | <!-- link to npm package or REST API docs --> |
| Auth model | <!-- API key / OAuth 2.0 authorization-code / OAuth 2.0 client-credentials / signed webhook --> |

## What does this integration let an operator do?

One paragraph: what action does an admin perform through this integration that they cannot do without it?

## Integration surface

Tick all that apply:

- [ ] **Connect**: admin enters credentials (or completes OAuth) and the integration's verify() call confirms the credentials work.
- [ ] **Display**: integration provides data that the admin UI surfaces (stats, dashboards, logs).
- [ ] **Trigger**: framework calls the integration on a CMS event (deploy hook, content publish, comment moderation).
- [ ] **Receive webhook**: integration calls into Astropress at `/api/webhooks/<provider>`.

## Why this provider (not a competitor)?

Astropress's per-domain integration registry intentionally limits how many providers we ship per domain (see rubric 56, "no speculative features"). If two analytics providers already exist, what does this one offer that they don't?

## Can you help implement it?

- [ ] I can submit a draft `registerXxx()` call with a `verify()` helper.
- [ ] I can submit tests against the provider's documented error shapes.
- [ ] I am requesting only — please prioritise alongside other community requests.

## Pointers

- `packages/astropress/src/integrations/registry.ts` — registry shape
- `packages/astropress/src/integrations/providers/` — provider implementations
- `docs/reference/integrations.md` — public-facing reference
