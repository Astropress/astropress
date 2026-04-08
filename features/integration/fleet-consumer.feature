Feature: Consuming AstroPress as a local package dependency
  As a developer working on a site that uses AstroPress
  I want to install AstroPress from a local file path during development
  So that I can test changes to the package before publishing a new version

  Scenario: A developer consuming AstroPress from a local package gets the same routes as a published install
    Given a host project installs AstroPress from a local file path instead of the npm registry
    When the developer visits /ap-admin
    Then the full admin route inventory is available and identical to a production install
