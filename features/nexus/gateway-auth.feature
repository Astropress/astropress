Feature: Nexus gateway authentication
  As a security-conscious operator
  I want nexus to require an org-level token
  So that only authorized clients can reach the sites behind the gateway

  Background:
    Given a nexus gateway is configured with an org auth token

  Scenario: Request without token is rejected
    When an unauthenticated request is made to GET /sites
    Then the response status is 401
    And the response body contains an error field

  Scenario: Request with wrong token is rejected
    When a request with an invalid token is made to GET /sites
    Then the response status is 401

  Scenario: Request with correct token is accepted
    When a request with the correct org token is made to GET /sites
    Then the response status is 200

  Scenario: Health endpoint does not require auth
    When an unauthenticated request is made to GET /
    Then the response status is 200
