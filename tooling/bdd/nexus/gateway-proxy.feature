Feature: Nexus site-scoped proxy routing
  As an operator
  I want to access any member site's API through nexus using a site-scoped URL
  So that I do not need to manage per-site tokens from the client

  Background:
    Given a nexus gateway is configured with two registered sites

  Scenario: Proxy routes content request to the correct member site
    Given site "site-a" returns a content list when queried
    When a request is made to GET /sites/site-a/content
    Then the response status is 200
    And the response body contains content from site-a

  Scenario: Proxy routes settings request to the correct member site
    Given site "site-a" returns settings when queried
    When a request is made to GET /sites/site-a/settings
    Then the response status is 200

  Scenario: Proxy routes media request to the correct member site
    Given site "site-a" returns a media list when queried
    When a request is made to GET /sites/site-a/media
    Then the response status is 200

  Scenario: Proxy returns 404 for an unknown site
    When a request is made to GET /sites/unknown-site/content
    Then the response status is 404

  Scenario: Degraded site is surfaced without failing the gateway
    Given site "site-b" is unreachable
    When a request is made to GET /sites/site-b/content
    Then the response status is 502
    And the response body contains an error field
