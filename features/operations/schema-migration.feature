Feature: Schema migration runner
  As a site operator
  I want to apply numbered SQL migration files to the production database
  So that schema changes are tracked and applied safely across framework upgrades

  Scenario: Operator applies new SQL migrations and skips already-applied ones
    Given an Astropress SQLite database with a schema_migrations table
    When the operator places numbered .sql files in a migrations/ directory
    And runs "astropress db migrate"
    Then the new migration files are applied in lexicographic order
    And the applied migrations are recorded in schema_migrations
    And running "astropress db migrate" again skips the already-applied files

  Scenario: Dry-run migration preview shows what would be applied without writing changes
    Given an Astropress SQLite database with pending migrations
    When the operator runs "astropress db migrate --dry-run"
    Then the pending migrations are listed without being written to the database
    And the schema_migrations table remains unchanged

  Scenario: Migration runner handles a missing migrations directory gracefully
    Given an Astropress SQLite database with no migrations directory
    When the operator runs "astropress db migrate"
    Then no error is raised and an empty result is returned

  Scenario: rollback_sql is stored with each migration when a .down.sql companion file exists
    Given a migrations directory with "0001_add_tags.sql" and a companion "0001_add_tags.down.sql"
    When the migration is applied via runAstropressMigrations
    Then the rollback_sql column in schema_migrations contains the .down.sql content

  Scenario: Doctor warns when the database schema is ahead of the framework version
    Given an Astropress SQLite database with more migrations than the framework baseline
    When checkSchemaVersionAhead is called
    Then it returns isAhead: true with the database count and framework baseline count
