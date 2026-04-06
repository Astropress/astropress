# Astropress Operations

This is the current operator runbook for local and small-organization Astropress deployments.

## Core checks

- `astropress doctor`
  - validates the package-owned env contract
  - resolves the runtime and deploy plan
  - warns about missing local secrets, weak session secrets, scaffold-style local passwords, bootstrap-password exposure, missing `.data/` paths, missing `ASTROPRESS_SERVICE_ORIGIN`, and projects still relying on legacy provider inference instead of explicit `ASTROPRESS_APP_HOST` and `ASTROPRESS_CONTENT_SERVICES`
- `bun run audit:security`
  - checks for inline handlers, missing hardening expectations, and risky local patterns
- `bun run test:acceptance`
  - runs the current Playwright + axe acceptance layer
- `astropress services bootstrap`
  - writes a local manifest under `.astropress/services/` for the selected content-services layer
- `astropress services verify`
  - confirms that the selected content-services layer has the required keys and a known service origin

## Backup and restore

- Create a content/config snapshot:
  - `astropress backup --project-dir <site> --out <snapshot-dir>`
- Restore a snapshot into a project:
  - `astropress restore --project-dir <site> --from <snapshot-dir>`

Current scope:

- snapshots are file-based exports using the packaged sync adapter
- this is suitable for source/config backup and recovery workflows
- database-native backup for hosted providers still needs provider-specific implementation

## Local bootstrap

- `astropress new <site>`
- choose an app host and content-services pair when the default static path is not enough:
  - `astropress new <site> --app-host vercel --content-services supabase`
  - `astropress new <site> --app-host cloudflare-pages --content-services cloudflare`
- `cd <site>`
- `bun install`
- `astropress doctor`
- `astropress services bootstrap`
- `astropress services verify`
- `astropress dev`

## WordPress staging

- `astropress import wordpress --project-dir <site> --source <export.xml>`
- Optional staging flags:
  - `--artifact-dir <dir>`
  - `--download-media`
  - `--apply-local`
  - `--resume`

Current scope:

- writes staged inventory, plan, report, content, media, comment, user, taxonomy, redirect, remediation, and download-state artifacts under `.astropress/import/` or a chosen artifact directory
- can download attachment assets into a resumable staged `downloads/` directory
- can apply the staged import into the supported local SQLite runtime and record a `wordpress.local-apply.json` report
- flags shortcode and page-builder cleanup work with explicit remediation candidates
- still stages into operator-reviewed artifacts rather than auto-writing directly into every provider runtime

## Secret handling

- generate a long random `SESSION_SECRET` before any real deployment
- rotate scaffolded `ADMIN_PASSWORD` and `EDITOR_PASSWORD` before handing the system to real editors
- set `ADMIN_BOOTSTRAP_DISABLED=1` once named admin accounts are established
- treat missing `TURNSTILE_SECRET_KEY` as a release blocker for hosted login surfaces

## Remaining operational gaps

- hosted-provider restore and rollback flows
- automated rotation for bootstrap credentials and session secrets
- release-by-release migration runbooks
- disaster recovery playbooks for real hosted environments
