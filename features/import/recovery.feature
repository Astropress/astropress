Feature: Import failure recovery
  As a site operator
  I want an interrupted import to resume from where it stopped
  So that I do not re-download or re-process content that was already imported

  Background:
    Given the AstroPress CLI is installed and available on the PATH
    And an Astropress project exists in the current directory

  Scenario: Interrupted WordPress import resumes without re-fetching completed media
    Given a WordPress import was started with "--download-media" and was interrupted after 50 of 100 media files were downloaded
    When the operator re-runs the import with "--resume"
    Then the CLI resumes from the interrupted state
    And only the remaining 50 media files are downloaded
    And no previously imported content records are duplicated

  Scenario: Failed import records are listed in the report for manual review
    Given a WordPress import completes with some records that could not be processed
    When the operator reviews the import report in ".astropress/import/wordpress.report.json"
    Then the report lists each failed record with its ID and the reason it was skipped
    And the overall import is not marked as failed unless all records were rejected

  Scenario: Import can be restarted cleanly after a hard failure
    Given a previous import left a partial artifact directory
    When the operator re-runs the import without "--resume"
    Then the import starts fresh and overwrites the partial artifacts
    And the CLI does not error due to pre-existing files in the artifact directory
