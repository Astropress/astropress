Feature: URL redirect management
  As a site administrator
  I want to manage URL redirects from the admin panel
  So that visitors following old links are automatically sent to the correct page

  Scenario: An admin creates a redirect from an old URL to a new one
    Given the admin is on the Redirects page of the admin panel
    When they add a redirect from "/old-post" to "/new-post" and save
    Then a visitor going to "/old-post" is redirected to "/new-post"

  Scenario: An admin deletes a redirect that is no longer needed
    Given a redirect from "/seasonal-promo" to "/offers" is configured
    When the admin deletes that redirect in the panel
    Then the old URL no longer redirects and the entry is gone from the redirects list
