Feature: Full editorial WordPress import
  Scenario: Importing a WordPress site migrates editorial data
    Given a supported WordPress export or source site
    When the operator runs "astropress import wordpress"
    Then pages posts media redirects comments and users are imported into Astropress
