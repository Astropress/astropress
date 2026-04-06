# Security Policy

## Scope

Astropress currently enforces and tests:

- CSRF defenses and cross-origin POST rejection on package-owned admin/auth actions
- admin/auth security headers and secure redirect handling
- HTML sanitization for reviewed editor content
- dependency audit, source-level security audit, CodeQL/Semgrep/Gitleaks, and ZAP baseline workflows
- browser accessibility checks for the public example and seeded package-owned admin harness

## Reporting

Do not open public issues for suspected vulnerabilities that expose live credentials, authentication bypass, stored XSS, or privilege escalation.

Use a private disclosure path for real deployments. This repository does not yet define a public security contact mailbox, which remains a product-readiness gap.

## Current limitations

- authenticated dynamic security scanning for real hosted deployments still depends on staging credentials and environments
- hosted-provider secret rotation and rollback procedures are not yet complete
- the WordPress importer currently stages import artifacts rather than completing a full persisted migration
