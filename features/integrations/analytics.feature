Feature: Analytics and observability integration configuration
  As a site owner
  I want to configure analytics and heatmap tools through registerCms()
  So that visitor data and UX insights are collected without modifying the core package

  Background:
    Given the site is deployed with the admin panel enabled

  Scenario: Analytics dashboard embeds in the admin panel via iframe
    Given a host configures analytics with type "umami", mode "iframe", and a dashboard URL
    When an admin navigates to /ap-admin/services/analytics
    Then the analytics dashboard loads in a full-screen iframe
    And the analytics nav item appears in the services sidebar section

  Scenario: Analytics configured in link mode shows an open button
    Given a host configures analytics with type "plausible" and mode "link"
    When an admin navigates to /ap-admin/services/analytics
    Then a branded "Open Plausible" button is shown that links to the external dashboard in a new tab

  Scenario: Analytics snippet helper returns correct script tag for Umami
    Given analytics is configured with type "umami" and a websiteId
    When resolveAnalyticsSnippet is called with that config
    Then the result is a script tag with data-website-id set to the configured ID

  Scenario: No analytics configured hides the analytics nav item
    Given no analytics is configured in the CMS registration
    When the admin nav is rendered
    Then no analytics or observability entry appears in the services sidebar section

  Scenario: AEO schema configuration is available on the SEO settings page
    Given the site has schemaOrg and faqSchema fields configured
    When an admin navigates to /ap-admin/seo
    Then the structured data configuration section is visible
    And JSON-LD schema output is previewed for the configured content
