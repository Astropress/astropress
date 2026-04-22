Feature: astropress auth emergency-revoke — revoke all sessions and tokens under compromise
  As a site operator responding to a credential compromise
  I want a single CLI command to revoke sessions and API tokens
  So that I can lock out an attacker without needing access to the admin UI or raw SQL

  Background:
    Given an Astropress project directory with a local SQLite database

  Scenario: --all revokes every active session and API token
    Given the database contains active sessions and unexpired API tokens
    When I run "astropress auth emergency-revoke --all"
    Then all admin sessions have a non-null revoked_at timestamp
    And all API tokens have a non-null revoked_at timestamp
    And the command prints the count of revoked sessions and tokens
    And an audit event with action "auth.emergency-revoke" is recorded

  Scenario: --sessions-only revokes sessions without touching tokens
    Given the database contains active sessions and unexpired API tokens
    When I run "astropress auth emergency-revoke --sessions-only"
    Then all admin sessions have a non-null revoked_at timestamp
    And API token revoked_at timestamps are unchanged

  Scenario: --tokens-only revokes API tokens without touching sessions
    Given the database contains active sessions and unexpired API tokens
    When I run "astropress auth emergency-revoke --tokens-only"
    Then all API tokens have a non-null revoked_at timestamp
    And admin session revoked_at timestamps are unchanged

  Scenario: --all --user scopes revocation to a single user's sessions
    Given the database contains sessions for multiple admin users
    When I run "astropress auth emergency-revoke --all --user admin@example.com"
    Then only sessions belonging to admin@example.com are revoked
    And sessions for other users are unchanged

  Scenario: --all prints a bootstrap password warning
    When I run "astropress auth emergency-revoke --all"
    Then the command prints a warning about the bootstrap password remaining active

  Scenario: Running without a scope flag returns a clear usage error
    When I run "astropress auth emergency-revoke" without any scope flag
    Then the command exits with a non-zero status
    And the error message lists --all, --sessions-only, and --tokens-only
