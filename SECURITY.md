# Security Policy

## Scope

Astropress currently enforces and tests:

- CSRF defenses and cross-origin POST rejection on package-owned admin/auth actions
- admin/auth security headers and secure redirect handling
- HTML sanitization for reviewed editor content
- dependency audit, source-level security audit, CodeQL/Semgrep/Gitleaks, and ZAP baseline workflows
- browser accessibility checks for the public example and seeded package-owned admin harness

## Reporting a Vulnerability

Do not open public issues for suspected vulnerabilities that expose live credentials, authentication bypass, stored XSS, or privilege escalation.

Use GitHub's private security advisory feature:
**[Report a vulnerability](https://github.com/withastro/astropress/security/advisories/new)**

Response SLA:
- Acknowledgement within **7 days**
- Assessment and severity classification within **14 days**
- Critical vulnerabilities resolved within **30 days**

## v0 Stability Note

Astropress is pre-1.0. Security interfaces (session contract, CSRF guard, sanitisation allowlist) are subject to breaking change. See [CHANGELOG.md](./CHANGELOG.md) for version-specific notes before upgrading.

## Current limitations

- authenticated dynamic security scanning for real hosted deployments still depends on staging credentials and environments
- hosted-provider secret rotation and rollback procedures are not yet complete
- the WordPress importer currently stages import artifacts rather than completing a full persisted migration
