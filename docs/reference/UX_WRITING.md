# UX Writing Guide

Astropress UI and CLI copy should help an operator recover, not just acknowledge failure.

## Rules

- Name the failed action: `"Password reset email could not be sent."` instead of a generic error.
- Point to the next check or recovery step when one exists.
- Prefer verb-first button labels such as `"Save draft"`, `"Create page"`, and `"Trigger redeploy"`.
- Empty states should tell the operator what to do next.
- Avoid fallback phrases that hide context. The microcopy audit rejects the worst offenders and should stay that way.

## Banned low-signal fallbacks

- Generic unlabeled failure banners.
- Generic retry prompts with no recovery detail.
- Vague placeholders that do not describe what failed.
