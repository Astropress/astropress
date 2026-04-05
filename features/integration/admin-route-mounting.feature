Feature: Admin route mounting
  Scenario: Astropress owns the admin route inventory
    Given Astropress exposes a package-owned admin route manifest
    When a host site mounts the Astropress admin app
    Then the host should consume the Astropress route inventory instead of copying admin routes locally

  Scenario: Astropress keeps admin actions and pages under one mount
    Given Astropress exposes page, action, and endpoint routes for the admin app
    When a host site mounts the Astropress admin app at /wp-admin
    Then the host should receive the full admin surface from Astropress without redefining each route
