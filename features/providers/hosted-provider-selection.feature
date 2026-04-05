Feature: Hosted provider selection is package-owned
  Scenario: Hosted providers can be selected without host-app branching
    Given an Astropress project with hosted provider env for Supabase or Runway
    When the consumer loads the hosted adapter through Astropress
    Then Astropress resolves the hosted provider and validates the provider-specific env contract before creating the adapter
