Feature: Provider portability
  Scenario: The same project can publish through first-party adapters
    Given an Astropress project with canonical content in the database
    When the operator deploys it to GitHub Pages Cloudflare Supabase or Runway
    Then the provider-specific work stays behind a common deploy contract

  Scenario: Startup selects the correct runtime mode from one project contract
    Given an Astropress project env contract for local or hosted operation
    When startup code asks Astropress for the project adapter
    Then Astropress selects the matching local or hosted provider adapter without host-app branching
