Feature: CMS editorial and host infrastructure panels

  Background:
    Given an Astropress admin panel is running

  Scenario: Self-hosted CMS embeds in the admin panel via iframe
    Given the site has cms.type = "payload" and cms.url = "http://localhost:3000"
    When an admin navigates to /ap-admin/cms
    Then the cms page loads with an iframe pointing to "http://localhost:3000"
    And the iframe fills the main content area

  Scenario: Cloud CMS shows an open button linking to the external panel
    Given the site has cms.type = "contentful"
    When an admin navigates to /ap-admin/cms
    Then a link to the external Contentful panel is shown
    And the link opens in a new tab

  Scenario: No CMS configured hides the CMS nav item
    Given no cms is configured in astropress.json
    When the admin nav is rendered
    Then the "CMS" nav item does not appear in the sidebar

  Scenario: Editor cannot access the host infrastructure panel
    Given the user is logged in as an editor
    When the admin nav is rendered
    Then the "Host" nav item does not appear in the sidebar

  Scenario: Admin can access the host infrastructure panel
    Given the user is logged in as an admin
    And the adapter declares a hostPanel capability
    When the admin nav is rendered
    Then the "Host" nav item appears in the sidebar

  Scenario: Unauthenticated user cannot access CMS or Host panels
    Given the user is not logged in
    When the user attempts to access /ap-admin/cms
    Then the user is redirected to the admin login page
