Feature: Hosted database provider selection
  As a developer
  I want to choose a hosted database provider for my AstroPress site
  So that my content is managed in the cloud without running my own server

  Scenario: A developer can switch to a hosted database provider without modifying any application code
    Given an AstroPress project configured for a hosted provider such as Supabase or Runway
    When the developer sets the provider environment variables and deploys
    Then the admin panel and all content operations use that hosted provider automatically
