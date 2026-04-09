Feature: URL redirect management
  As a site administrator
  I want to manage URL redirects from the admin panel
  So that visitors following old links are automatically sent to the correct page

  Background:
    Given an admin is signed in to the admin panel
    And the admin is on the Redirects page

  Scenario: Admin creates a 301 redirect from an old URL to a new one
    When the admin adds a redirect from "/old-post" to "/new-post" with status 301 and saves
    Then a request to "/old-post" returns HTTP 301 with Location: /new-post

  Scenario: Admin creates a 302 temporary redirect
    When the admin adds a redirect from "/sale" to "/offers" with status 302 and saves
    Then a request to "/sale" returns HTTP 302 with Location: /offers

  Scenario: Admin deletes a redirect that is no longer needed
    Given a redirect from "/seasonal-promo" to "/offers" is configured
    When the admin deletes that redirect
    Then requests to "/seasonal-promo" return HTTP 404
    And the redirect entry is gone from the redirects list

  Scenario: Admin cannot create a redirect where source and target are the same
    When the admin attempts to add a redirect from "/page" to "/page"
    Then the form shows an error: "Source and target cannot be the same"
    And no redirect is saved
