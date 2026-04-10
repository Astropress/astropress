Feature: REST API for AI agents and external integrations
  As an AI agent or external system
  I want a stable REST API with Bearer token authentication
  So that I can read and write site content programmatically without screen-scraping the admin

  Background:
    Given an Astropress site has API access enabled
    And a valid API token exists with appropriate scopes

  Scenario: AI agent reads published content via REST API
    Given the token has scope "content:read"
    When the agent sends GET /ap-api/v1/content with the Bearer token
    Then the response is 200 OK with a paginated JSON array of content records
    And the response includes total, limit, offset, and page fields
    And the response includes an X-Total-Count header with the total record count

  Scenario: AI agent paginates content using page and per_page parameters
    Given the token has scope "content:read"
    When the agent sends GET /ap-api/v1/content?page=2&per_page=10 with the Bearer token
    Then the response is 200 OK with at most 10 content records
    And the response body includes page=2 and limit=10
    And the response includes an X-Total-Count header

  Scenario: AI agent creates a new draft post via REST API
    Given the token has scope "content:write"
    When the agent sends POST /ap-api/v1/content with a valid content record body
    Then the response is 201 Created with the saved record
    And the record is retrievable via GET /ap-api/v1/content/:id

  Scenario: Request without Authorization header is rejected
    When a request arrives at /ap-api/v1/content with no Authorization header
    Then the response is 401 Unauthorized with a JSON error body

  Scenario: Token with insufficient scope is rejected
    Given the token has only scope "content:read"
    When the agent sends POST /ap-api/v1/content with the Bearer token
    Then the response is 403 Forbidden with a JSON error body

  Scenario: OpenAPI spec is publicly accessible without authentication
    When any client sends GET /ap-api/v1/openapi.json
    Then the response is 200 OK with a valid OpenAPI 3.1 JSON document
    And the document describes all /ap-api/v1/* endpoints and their required scopes

  Scenario: REST API endpoints return 404 when API is not enabled
    Given the site does not have API access enabled
    When a request arrives at /ap-api/v1/content
    Then the response is 404 Not Found
