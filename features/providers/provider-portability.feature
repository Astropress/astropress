Feature: Provider portability
  Scenario: The same project can publish through first-party adapters
    Given an Astropress project with canonical content in the database
    When the operator deploys it to GitHub Pages Cloudflare Supabase or Runway
    Then the provider-specific work stays behind a common deploy contract
