Feature: Nexus fan-out queries across all sites
  As an operator
  I want to query content across all my sites at once
  So that I can search or aggregate without calling each site individually

  Background:
    Given a nexus gateway is configured with two registered sites

  Scenario: Fan-out content query returns results from all available sites
    Given both sites return content when queried
    When a request is made to GET /content
    Then the response status is 200
    And the response body includes content items from both sites
    And each item includes a siteId field identifying its origin

  Scenario: Fan-out continues when one site is degraded
    Given site "site-a" returns content when queried
    And site "site-b" is unreachable
    When a request is made to GET /content
    Then the response status is 200
    And the response body includes content items from site-a
    And the response body includes a degraded entry for site-b

  Scenario: Metrics endpoint aggregates counts across all sites
    Given both sites return metrics when queried
    When a request is made to GET /metrics
    Then the response status is 200
    And the response body contains a total post count across all sites
    And the response body contains a siteCount field
