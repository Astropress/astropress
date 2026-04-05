Feature: Project bootstrap follows package-owned defaults
  Scenario: New projects get provider-aligned env defaults
    Given an operator scaffolds a new Astropress project for sqlite Supabase or Runway
    When Astropress writes the project .env and .env.example files
    Then the local provider hosted provider and deploy target defaults come from Astropress package scaffolds rather than consumer-specific logic

  Scenario: Local development reads the scaffolded env contract
    Given a scaffolded Astropress project with provider-specific .env values
    When the operator runs "astropress dev"
    Then Astropress resolves the local provider admin database path and default deploy target from the shared env contract
