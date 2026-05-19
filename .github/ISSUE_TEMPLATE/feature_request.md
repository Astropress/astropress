---
name: Framework feature request
about: Propose a new framework capability or extension point — not tied to a specific provider, integration, or locale
title: "[Feature] "
labels: enhancement
assignees: ""
---

> **Not a framework feature?** If you want a specific provider, external tool, or language, please use the dedicated template instead:
>
> - [Adapter request](?template=adapter_support.md) — hosting providers and data services
> - [Integration request](?template=integration_request.md) — external tools (analytics, email, A/B, donations, webhooks)
> - [Language request](?template=language_request.md) — admin or content locale
>
> This template is for cross-cutting framework capabilities (new admin surfaces, new editor primitives, new build-pipeline hooks, etc.) that aren't tied to a single provider.

## Summary

One-sentence description of the feature.

## Problem it solves

What does the current framework make difficult or impossible that this would fix?

## Proposed API / behaviour

If this is an API change, sketch the ideal usage:

```ts
registerCms({
  // example of proposed new config
});
```

## Alternatives considered

Other approaches you have tried or thought about.

## Acceptance criteria

What would a passing test look like? (Optional but helpful for scoping.)
