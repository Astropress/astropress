Feature: Headless email / newsletter integration via Listmonk
  As a site owner
  I want a self-hosted, open-source newsletter system
  So that I can send campaigns and manage subscribers without vendor lock-in

  Scenario: Listmonk admin is accessible from the Services tab
    Given Listmonk is configured with LISTMONK_API_URL in .env
    When I visit "/ap-admin/services/email"
    Then the page embeds the Listmonk admin UI in an iframe

  Scenario: Subscriber endpoint forwards to Listmonk API
    Given the site has a newsletter signup form
    When a visitor submits their email
    Then the submission is forwarded to the Listmonk subscriber API

  Scenario: Import pipeline can extract WordPress subscribers
    Given a WordPress XML export contains subscriber metadata
    When the import runs with --import-subscribers
    Then a JSON file of subscribers is created in the artifact directory
    And a log entry notes how to bulk-import into Listmonk via its REST API

  Scenario: Listmonk service appears in scaffold prompts
    When I run "astropress new my-site" and choose email integration
    Then "Listmonk" is presented as the default option
    And "Keila" is presented as an alternative
