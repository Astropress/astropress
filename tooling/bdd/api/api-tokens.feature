Feature: API token management for programmatic access
  As a site administrator
  I want to create and manage API tokens with fine-grained scopes
  So that external tools and AI agents can access site content without sharing admin credentials

  Background:
    Given an Astropress admin panel is running

  Scenario: Admin can create an API token with selected scopes
    Given the user is logged in as an admin
    And the site has API access enabled in its configuration
    When the admin creates a new API token with label "AI assistant" and scopes "content:read"
    Then a raw token is displayed exactly once
    And the token record is listed on the API tokens page with its label and scopes
    And the raw token is not stored or retrievable again

  Scenario: API token verification succeeds for a valid unrevoked token
    Given a valid API token exists with scope "content:read"
    When a request arrives with that token in the Authorization Bearer header
    Then the request is authenticated and the token's last used timestamp is updated

  Scenario: Revoked API token is rejected
    Given a valid API token exists
    When an admin revokes that token
    And a request arrives with the revoked token in the Authorization Bearer header
    Then the request is rejected with a 401 Unauthorized response

  Scenario: Editor cannot access the API tokens management page
    Given the user is logged in as an editor
    When the user navigates to /ap-admin/api-tokens
    Then the user is redirected away with an authorization error

  Scenario: API tokens page is hidden when API is not enabled
    Given the site does not have API access enabled in its configuration
    When the admin nav is rendered
    Then the "API Tokens" nav item does not appear in the sidebar
