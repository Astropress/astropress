Feature: Admin and production domain separation

  Background:
    Given an Astropress project is initialized

  Scenario: Production static build contains no admin routes
    Given a site built with createAstropressPublicSiteIntegration
    When the static build completes
    Then the integration registers no routes matching /ap-admin
    And no injected route pattern contains the string "ap-admin"

  Scenario: Admin domain serves the admin panel
    Given a site built with createAstropressAdminAppIntegration
    When the integration is configured
    Then routes matching /ap-admin are injected
    And the security middleware is registered

  Scenario: Public integration is a valid AstroIntegration
    Given createAstropressPublicSiteIntegration is called with no options
    When the integration object is inspected
    Then the returned object has a name property set to "astropress-public-site"
    And the returned object has an astro:config:setup hook

  Scenario: Public integration accepts a buildHookSecret option
    Given createAstropressPublicSiteIntegration is called with buildHookSecret "abc123"
    When the integration is created
    Then the integration returns successfully without error

  Scenario: Admin integration is unaffected by the new public integration
    Given both integrations are created independently
    When each hook is invoked with a route spy
    Then createAstropressAdminAppIntegration still injects all admin routes
    And createAstropressPublicSiteIntegration injects zero admin routes

  Scenario: Testimonials ingest endpoint is not injected by the public site integration
    Given a site built with createAstropressPublicSiteIntegration
    When the static build completes
    Then no injected route pattern contains the string "testimonials"
    And no injected route pattern contains the string "ap-api"

  Scenario: Testimonials ingest endpoint is injected by the admin integration
    Given a site built with createAstropressAdminAppIntegration
    When the integration is configured
    Then routes matching /ap-api/v1/testimonials/ingest are injected
