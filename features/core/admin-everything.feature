Feature: Non-technical admin can edit the whole site
  Scenario: Admin edits a page through the package-owned editor without using git
    Given a signed-in admin user
    When the admin edits a page title body SEO fields and publish state
    Then the updated page is visible in the editor preview and saved through the package-owned admin workflow

  Scenario: Admin manages redirects and opens the media library from the same admin panel
    Given a signed-in admin user
    When the admin opens the media library and adds a redirect
    Then both workflows are available without provider-specific steps
