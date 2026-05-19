---
name: Language / locale request
about: Request a new admin or public-site language (locale)
title: "[Locale] "
labels: i18n, enhancement
assignees: ""
---

## Locale details

| Field | Value |
|-------|-------|
| Language name (English) | <!-- e.g. Portuguese, Arabic, Tagalog --> |
| Language name (native) | <!-- e.g. Português, العربية, Tagalog --> |
| BCP-47 code | <!-- e.g. pt, ar, tl --> |
| Script direction | <!-- ltr / rtl --> |

## What needs the locale

Tick the surfaces this request covers:

- [ ] Admin shell (`AdminLocale`) — sidebar, login, dashboards, content editors
- [ ] Public-site templates — site-layout `lang`/`dir`, public-facing CMS-rendered content
- [ ] Public-site CMS content — actual translated articles authored by operators (this is a *content* concern, not a framework concern; framework only needs to recognise the locale)

## Native-speaker review

The admin label catalog is large (1000+ entries split across `admin-labels.ts` and `admin-page-labels.ts`). Initial seed translations land with a `TODO(i18n-<code>): native-speaker review (issue #N)` marker. Indicate who will review:

- [ ] I am a native or fluent speaker and will review the seed translations.
- [ ] I will help recruit a reviewer.
- [ ] I am only requesting — someone else will review.

## Anything else

RTL languages (Arabic, Hebrew, Persian, Urdu) need additional plumbing: the `dir="rtl"` attribute on `<html>`, mirrored iconography, and CSS logical properties throughout the admin and public site. Issue #72 tracked the Arabic pass — file a sibling issue for any new RTL language and reference it.
