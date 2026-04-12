Feature: Importing content from a WordPress site
  As a site owner migrating from WordPress
  I want to import all my content into AstroPress
  So that I can switch platforms without losing posts, media, or metadata

  Scenario: An operator can review all imported posts and pages before they go live
    Given a WordPress XML export file
    When the operator runs "astropress import wordpress"
    Then an inventory file lists every post, page, media item, comment, user, and taxonomy from the export

  Scenario: An operator receives a human-readable report after running astropress import wordpress
    Given a WordPress export containing shortcode or page-builder markup
    When the operator runs "astropress import wordpress"
    Then a report file summarises what was imported and flags any items needing manual review

  Scenario: An operator can resume an interrupted import without re-downloading already-saved media
    Given an import has been partially run and some media files are already downloaded
    When the operator reruns "astropress import wordpress --resume --download-media"
    Then previously downloaded media is reused and only missing files are fetched

  Scenario: Content from WordPress with unusual status values is imported in a valid editorial state
    Given a WordPress export contains posts with pending, future, or private status
    When the operator runs "astropress import wordpress"
    Then pending and future posts become drafts and private posts become archived in AstroPress

  Scenario: Special characters in WordPress content survive the import unchanged
    Given a WordPress export contains posts with XML entity references and Unicode characters
    When the operator runs "astropress import wordpress"
    Then the rendered content shows the correct characters with no encoding artifacts

  Scenario: An operator receives a JSON report file summarising the import for automation and logging
    Given a WordPress export with posts, comments, and media
    When the operator runs "astropress import wordpress" with an artifact directory
    Then the artifact directory contains an import-report.json with entity counts, errors, and review flags
