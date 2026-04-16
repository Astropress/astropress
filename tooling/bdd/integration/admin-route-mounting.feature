Feature: Admin panel navigation and route ownership
  As an admin
  I want all admin pages to be reachable through a single /ap-admin base path
  So that I can bookmark the admin entry point and navigate any section from there

  Scenario: An admin can reach any section of the panel through the /ap-admin base path
    Given the AstroPress admin is mounted on a site
    When the admin visits /ap-admin
    Then they can navigate to posts, pages, media, users, settings, and all other admin sections

  Scenario: All admin form submissions stay within /ap-admin so operators expose one path in production
    Given the admin panel is running
    When the admin submits any form in the panel
    Then the form action posts to a path under /ap-admin rather than a separate endpoint

  Scenario: A developer consuming AstroPress from a local package gets the same admin panel as a published install
    Given a host project installs AstroPress from a local file path
    When the developer visits /ap-admin
    Then the full admin route inventory is available identical to a production install

  Scenario: All admin panel routes are reachable without source-level import aliases
    Given the astropress package is configured without monorepo Vite aliases
    When the dev server starts and every /ap-admin route is requested
    Then every route returns HTTP 200 and has stylesheets loaded
