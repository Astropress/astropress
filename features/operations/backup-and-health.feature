Feature: Operator backup and health checks
  Scenario: Operators can export and restore a packaged project snapshot
    Given an Astropress project with file-backed content
    When the operator runs "astropress backup" and "astropress restore"
    Then Astropress should round-trip the snapshot through the packaged sync workflow

  Scenario: Operators can diagnose missing local secrets and paths
    Given an Astropress project with incomplete local runtime configuration
    When the operator runs "astropress doctor"
    Then Astropress should report missing local secrets and local data-path warnings
