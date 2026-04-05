Feature: Full editorial WordPress import
  Scenario: Importing a WordPress site migrates editorial data
    Given a supported WordPress export or source site
    When the operator runs "astropress import wordpress"
    Then pages posts media redirects comments and users are imported into Astropress

  Scenario: WordPress import produces inspect plan and report artifacts
    Given a WordPress export contains shortcode or page-builder markup
    When the operator runs "astropress import wordpress"
    Then Astropress should write inventory plan and report artifacts and flag the import for manual review
