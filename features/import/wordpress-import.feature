Feature: Full editorial WordPress import
  Scenario: Importing a WordPress export stages editorial inventory into Astropress import artifacts
    Given a supported WordPress export or source site
    When the operator runs "astropress import wordpress"
    Then Astropress writes inventory plan report content media comment user taxonomy and redirect artifacts for import

  Scenario: WordPress import produces inspect plan and report artifacts
    Given a WordPress export contains shortcode or page-builder markup
    When the operator runs "astropress import wordpress"
    Then Astropress should write inventory plan and report artifacts and flag the import for manual review

  Scenario: WordPress import can resume staged media downloads
    Given a staged WordPress import artifact directory
    When the operator reruns "astropress import wordpress --resume --download-media"
    Then Astropress should reuse completed media downloads and continue any unfinished staged downloads

  Scenario: WordPress import normalizes non-standard post statuses for editorial workflow
    Given a WordPress export with posts in pending future or private status
    When the operator runs "astropress import wordpress"
    Then pending and future posts become draft and private posts become archived in the content artifacts

  Scenario: WordPress import preserves content fidelity for XML entity references
    Given a WordPress export with posts containing decimal hex and named XML entities
    When the operator runs "astropress import wordpress"
    Then numeric entities are decoded to their characters and unrecognized entities are preserved verbatim

  Scenario: WordPress import produces a structured operator-facing import report file
    Given a WordPress export with posts comments and media
    When the operator runs "astropress import wordpress" with an artifact directory
    Then Astropress writes an import-report.json file containing entity counts errors and manual-review flags
