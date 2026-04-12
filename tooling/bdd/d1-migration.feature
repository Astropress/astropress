Feature: D1 schema migration runner

  Astropress provides a programmatic migration runner for Cloudflare D1 databases
  that mirrors the SQLite migration runner's interface and report shape.

  Background:
    Given a D1-compatible database mock is available
    And a migrations directory with numbered .sql files

  Scenario: Apply a pending migration to D1
    Given migration file "0001_create_posts.sql" has not been applied
    When I call runD1Migrations with the migrations directory
    Then the migration is applied to the D1 database
    And the migration name appears in schema_migrations
    And the report lists "0001_create_posts.sql" in applied

  Scenario: Skip an already-applied D1 migration
    Given migration "0001_create_posts.sql" was previously applied
    When I call runD1Migrations with the same migrations directory
    Then no new SQL is executed
    And the report lists "0001_create_posts.sql" in skipped

  Scenario: Dry-run reports without writing
    Given migration "0001_create_posts.sql" is pending
    When I call runD1Migrations with dryRun: true
    Then the report lists the migration in applied
    But the schema_migrations table does not contain the migration

  Scenario: Rollback the last D1 migration
    Given migration "0001_create_posts.sql" was applied with a companion .down.sql
    When I call rollbackD1LastMigration
    Then the rollback SQL is executed against the D1 database
    And the migration record is removed from schema_migrations
    And the report status is "rolled_back"

  Scenario: Rollback returns no_rollback_sql when no .down.sql was provided
    Given migration "0001_create_posts.sql" was applied without a .down.sql file
    When I call rollbackD1LastMigration
    Then the report status is "no_rollback_sql"
    And the database is not modified

  Scenario: D1 migration report shape matches SQLite report shape
    When I call runD1Migrations
    Then the report contains fields: migrationsDir, applied, skipped, dryRun
    And the report shape is identical to the SQLite AstropressDbMigrateReport
