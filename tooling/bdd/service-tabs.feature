Feature: Service integrations tab in AstroPress admin
  As an admin
  I want to access integrated service dashboards from within the AstroPress admin
  So that I can manage CMS, commerce, community, and email from a single interface

  Background:
    Given AstroPress has a service registered with provider "cms", label "Payload CMS"

  Scenario: Services hub page shows all registered services
    When I visit "/ap-admin/services"
    Then I see a service card labelled "Payload CMS"
    And the card links to "/ap-admin/services/cms"

  Scenario: Service provider page embeds the external admin UI in an iframe
    When I visit "/ap-admin/services/cms"
    Then the page heading contains "Payload CMS"
    And an iframe is present pointing to the proxy path

  Scenario: Navigating directly to an unconfigured provider returns a graceful error
    When I visit "/ap-admin/services/unknown"
    Then I see a "Service not configured" message

  Scenario: Services nav item appears in the sidebar for admin users
    Given I am signed in as an admin
    When I visit "/ap-admin"
    Then the sidebar contains a "Services" navigation link
