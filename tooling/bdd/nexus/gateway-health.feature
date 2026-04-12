Feature: Nexus gateway health and site registry
  As an operator running multiple Astropress sites
  I want a single health endpoint that checks all sites at once
  So that I can monitor the status of my entire network from one place

  Background:
    Given a nexus gateway is configured with two registered sites

  Scenario: Health endpoint returns all registered sites with status
    When a request is made to GET /
    Then the response status is 200
    And the response body lists both registered sites
    And each site entry includes an id, name, and status field

  Scenario: Sites endpoint lists registered sites with live health
    When a request is made to GET /sites
    Then the response status is 200
    And the response body is an array of site objects

  Scenario: Single site endpoint returns site metadata
    When a request is made to GET /sites/site-a
    Then the response status is 200
    And the response body includes the site id "site-a"

  Scenario: Unknown site returns 404
    When a request is made to GET /sites/nonexistent
    Then the response status is 404
    And the response body contains an error field
