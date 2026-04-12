Feature: A/B testing and feature flag integration configuration
  As a site owner
  I want to configure an A/B testing tool through registerCms()
  So that I can run experiments without hosting a separate admin interface

  Background:
    Given the site is deployed with the admin panel enabled

  Scenario: GrowthBook dashboard embeds in the admin panel
    Given a host configures abTesting with type "growthbook", mode "iframe", and a dashboard URL
    When an admin navigates to /ap-admin/services/ab-testing
    Then the GrowthBook dashboard loads in a full-screen iframe
    And the A/B Testing nav item appears in the services sidebar section

  Scenario: Unleash configured in link mode shows an open button
    Given a host configures abTesting with type "unleash" and mode "link"
    When an admin navigates to /ap-admin/services/ab-testing
    Then a branded "Open Unleash" button is shown that links to the external dashboard in a new tab

  Scenario: No A/B testing configured hides the nav item
    Given no abTesting is configured in the CMS registration
    When the admin nav is rendered
    Then no A/B testing entry appears in the services sidebar section

  Scenario: CLI new command prompts for A/B testing provider selection
    Given a developer runs astropress new interactively
    When the A/B testing prompt appears
    Then the developer can choose from None, GrowthBook, Unleash, or Custom
    And the selected provider's environment variable stubs are written to .env
    And the registerCms() stub in the generated project includes the abTesting config block
