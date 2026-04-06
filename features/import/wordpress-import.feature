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
