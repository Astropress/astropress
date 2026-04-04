Feature: Non-technical admin can edit the whole site
  Scenario: Admin edits a page without using git
    Given a signed-in admin user
    When the admin edits a page title body SEO fields and publish state
    Then the updated page is visible in preview and the published site

  Scenario: Admin manages redirects and media from the same admin panel
    Given a signed-in admin user
    When the admin uploads media and adds a redirect
    Then both changes are persisted without provider-specific steps
