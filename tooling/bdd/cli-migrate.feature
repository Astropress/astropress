Feature: astropress migrate — switch between tools in the same category
  As a developer
  I want to migrate from one tool to another in the same feature category
  So that I get a migration guide and updated env stubs without re-scaffolding

  Scenario: astropress migrate --from rallly --to calcom generates a migration guide
    Given an existing Astropress project directory
    When I run "astropress migrate --from rallly --to calcom"
    Then MIGRATE-calcom.md is written to the project root
    And .env.example is updated with CALCOM_API_URL and CALCOM_API_KEY

  Scenario: astropress migrate --from medusa --to vendure generates a migration guide
    Given an existing Astropress project directory
    When I run "astropress migrate --from medusa --to vendure"
    Then MIGRATE-vendure.md is written to the project root

  Scenario: astropress migrate --from flarum --to discourse generates a migration guide
    Given an existing Astropress project directory
    When I run "astropress migrate --from flarum --to discourse"
    Then MIGRATE-discourse.md is written to the project root

  Scenario: astropress migrate --from ntfy --to gotify generates a migration guide
    Given an existing Astropress project directory
    When I run "astropress migrate --from ntfy --to gotify"
    Then MIGRATE-gotify.md is written to the project root

  Scenario: astropress migrate --from keystatic --to payload generates a migration guide
    Given an existing Astropress project directory
    When I run "astropress migrate --from keystatic --to payload"
    Then MIGRATE-payload.md is written to the project root

  Scenario: astropress migrate --from umami --to plausible generates a migration guide
    Given an existing Astropress project directory
    When I run "astropress migrate --from umami --to plausible"
    Then MIGRATE-plausible.md is written to the project root

  Scenario: astropress migrate --from and --to the same tool returns an error
    Given any project directory
    When I run "astropress migrate --from rallly --to rallly"
    Then the command exits with a non-zero status
    And the error message states that the source and destination are the same

  Scenario: astropress migrate between incompatible categories returns an error
    Given any project directory
    When I run "astropress migrate --from flarum --to umami"
    Then the command exits with a non-zero status
    And the error message identifies the category mismatch

  Scenario: astropress migrate with an unknown tool name returns an error
    Given any project directory
    When I run "astropress migrate --from unknown-tool --to rallly"
    Then the command exits with a non-zero status
    And the error message identifies the unknown tool

  Scenario: astropress migrate --dry-run prints the migration guide without writing files
    Given an existing Astropress project directory
    When I run "astropress migrate --from rallly --to calcom --dry-run"
    Then no files are written to the project directory
    And the migration guide content is printed to stdout
