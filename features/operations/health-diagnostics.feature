Feature: Project health diagnostics
  As a site operator
  I want to diagnose configuration problems with a single command
  So that I can catch missing secrets and misconfigured paths before they affect readers

  Scenario: Doctor reports missing local secrets and data-path warnings
    Given an Astropress project with incomplete local runtime configuration
    When the operator runs "astropress doctor"
    Then the CLI reports missing SESSION_SECRET, ADMIN_PASSWORD, and EDITOR_PASSWORD
    And warns that the ".data" directory does not exist

  Scenario: Doctor exits with a non-zero code in strict mode when warnings are present
    Given an Astropress project with one or more configuration warnings
    When the operator runs "astropress doctor --strict"
    Then the CLI exits with code 1
    And lists each warning on its own line

  Scenario: Doctor reports a clean bill of health for a fully configured project
    Given an Astropress project with all required environment variables and paths set
    When the operator runs "astropress doctor"
    Then the CLI reports no warnings and exits with code 0
