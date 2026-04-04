# GitHub Bootstrap

## Current Environment Check

As checked from the local development environment:

- `gh` is installed locally
- authenticated GitHub user: `shatachandra`
- visible org membership:
  - `anvil-foundry` with role `admin`

Observed token scopes:

- `admin:public_key`
- `gist`
- `read:org`
- `repo`

## What This Means

This environment can:

- inspect the authenticated user
- inspect visible org memberships
- manage repositories covered by the token

This environment does not currently prove that it can create a new GitHub organization.

Reasons:

- GitHub organization creation is primarily a web-account and billing workflow
- there is no normal `gh` command that directly confirms “can create orgs”
- the current token does not show an `admin:org` scope

## Practical Interpretation

Based on the observed auth state:

- there is evidence of org administration for `anvil-foundry`
- there is no evidence that this token or session can create a brand-new `astropress` organization automatically

Assume the org may need to be created manually in the GitHub web UI by an authorized account owner.

## Recommended Bootstrap Sequence

1. Create the `astropress` GitHub organization in the GitHub web UI.
2. Add billing, owners, and baseline org settings.
3. Create:
   - `astropress/astropress`
   - `astropress/.github`
4. Push this local repo to `astropress/astropress`.
5. Move the shared org health files into `astropress/.github`.
6. Publish the npm package and CLI releases from CI once the repo is connected.

## Repo Mapping

Current local repo intended for `astropress/astropress`:

- `/home/user/code/astropress`
