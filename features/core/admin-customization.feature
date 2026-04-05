Feature: Admin customization
  Scenario: Hosts can rename package-owned admin copy without forking the app
    Given Astropress exposes admin UI customization through registerCms
    When a host overrides admin branding, labels, and navigation names
    Then the package-owned admin shell should render the host naming instead of hardcoded Astropress defaults

  Scenario: Hosts can replace simple admin brand assets without copying templates
    Given Astropress exposes admin branding assets through registerCms
    When a host sets a custom logo and favicon for the admin app
    Then the package-owned admin shell and auth pages should use those assets without duplicating Astropress route files

  Scenario: Hosts can restyle package-owned admin pages without copying them
    Given Astropress exposes a custom admin stylesheet hook through registerCms
    When a host sets a client-specific admin stylesheet asset
    Then the package-owned admin shell and auth pages should load that stylesheet without duplicating Astropress route files
