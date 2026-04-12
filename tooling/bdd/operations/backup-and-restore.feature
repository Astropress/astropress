Feature: Project backup and restore
  As a site operator
  I want to export and restore a project snapshot
  So that I can migrate content between environments or recover from data loss

  Scenario: Operator exports a project snapshot and restores it cleanly
    Given an Astropress project with file-backed content and a populated database
    When the operator runs "astropress backup --out ./snapshot"
    Then a snapshot directory is created containing the database and content files
    When the operator runs "astropress restore --from ./snapshot" on a clean project
    Then all content records and files are present in the restored project
    And the site functions identically to the source
