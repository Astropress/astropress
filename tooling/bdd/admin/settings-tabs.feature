Feature: Settings page tabs reorganise import and newsletter management
  As an admin
  I want import and newsletter management inside Settings rather than top-level nav
  So that the sidebar stays focused and related tools are grouped together

  Scenario: Settings page shows General tab by default
    Given I am signed in as an admin
    When I visit "/ap-admin/settings"
    Then the page heading is "Settings"
    And the General tab is active
    And the Site Identity form is visible

  Scenario: Settings Newsletter tab shows subscriber list and Mailchimp import form
    Given I am signed in as an admin
    When I visit "/ap-admin/settings?tab=newsletter"
    Then the Newsletter tab is active
    And the page contains a subscriber list section
    And the page contains a Mailchimp CSV import form

  Scenario: Settings Import tab shows WordPress, Wix, and crawl source cards
    Given I am signed in as an admin
    When I visit "/ap-admin/settings?tab=import"
    Then the Import tab is active
    And the page contains a link to "/ap-admin/import/wordpress"
    And the page contains a link to "/ap-admin/import/wix"
    And the page contains a link to "/ap-admin/import/crawl"

  Scenario: /ap-admin/import redirects to Settings Import tab
    Given I am signed in as an admin
    When I visit "/ap-admin/import"
    Then I am redirected to "/ap-admin/settings?tab=import"

  Scenario: /ap-admin/subscribers redirects to Settings Newsletter tab
    Given I am signed in as an admin
    When I visit "/ap-admin/subscribers"
    Then I am redirected to "/ap-admin/settings?tab=newsletter"

  Scenario: Import and Subscribers are not top-level sidebar nav items
    Given I am signed in as an admin
    When I visit any admin page
    Then the sidebar does not contain a top-level "Import" link
    And the sidebar does not contain a top-level "Subscribers" link

  Scenario: Mailchimp CSV import uploads and returns imported count
    Given I am signed in as an admin
    And Listmonk is configured with valid LISTMONK_* environment variables
    When I upload a valid Mailchimp audience CSV with 3 subscriber rows
    Then I am redirected to "/ap-admin/settings?tab=newsletter&imported=3&skipped=0"
    And the Newsletter tab shows a success notice with the imported count
