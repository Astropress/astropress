Feature: Sync commands export and import content snapshots
  As a site operator
  I want to export and import content snapshots between environments
  So that I can migrate content without manual database operations

  Background:
    Given the AstroPress CLI is installed and available on the PATH
    And an Astropress project exists with local SQLite content

  Scenario: sync export produces a versioned content snapshot
    When the operator runs astropress sync export
    Then a versioned content snapshot artifact is written to the artifact directory

  Scenario: sync import applies a content snapshot to the local database
    Given a content snapshot artifact produced by sync export
    When the operator runs astropress sync import pointing at that artifact
    Then the content records are present in the local database

  Scenario: sync export produces git-committable output
    When the operator runs astropress sync export
    Then the snapshot artifact directory contains only text files suitable for git diff
