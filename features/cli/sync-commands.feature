Feature: Sync commands export and import content snapshots

  Scenario: sync export produces a versioned content snapshot
    Given a project with local SQLite content
    When the operator runs astropress sync export
    Then a versioned content snapshot artifact is written to the artifact directory

  Scenario: sync import applies a content snapshot to the local database
    Given a content snapshot artifact produced by sync export
    When the operator runs astropress sync import pointing at that artifact
    Then the content records are present in the local database

  Scenario: sync export produces git-committable output
    Given a project with local SQLite content
    When the operator runs astropress sync export
    Then the snapshot artifact directory contains only text files suitable for git diff
