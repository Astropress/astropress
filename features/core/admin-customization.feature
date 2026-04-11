Feature: Admin panel customization for site owners
  As a site owner
  I want to customize the admin panel branding and labels
  So that the panel reflects my brand without modifying the core package

  Background:
    Given the site is deployed with the admin panel enabled

  Scenario: Site owners can customize admin branding without modifying package code
    Given a host configures custom branding through the site's CMS settings
    When they override the admin panel name, navigation labels, and header copy
    Then the admin panel renders the custom names instead of the default "Astropress" branding
    And the core package files remain untouched

  Scenario: Site owners can replace the admin logo and favicon without copying templates
    Given a host provides a custom logo URL and favicon URL in the site's CMS settings
    When an admin loads the admin panel login page and dashboard
    Then the custom logo and favicon are displayed
    And no Astropress route files were duplicated to achieve this

  Scenario: Site owners can restyle the admin panel without duplicating route files
    Given a host specifies a custom stylesheet URL in the site's CMS settings
    When the admin panel pages are loaded
    Then the custom stylesheet is included in the page head
    And the host's CSS overrides are applied to the admin shell and auth pages

  Scenario: A plugin can inject a custom admin route via adminRoutes
    Given a plugin declares adminRoutes with pattern "/ap-admin/my-plugin" and an entrypoint path
    When the plugin is registered via registerCms({ plugins })
    Then the adminRoutes array is accessible via peekCmsConfig()
    And the route pattern and entrypoint are preserved exactly as declared
