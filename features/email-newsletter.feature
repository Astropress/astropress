Feature: Headless email / newsletter integration via Listmonk
  As a site owner
  I want a self-hosted, open-source newsletter system
  So that I can send campaigns and manage subscribers without vendor lock-in

  Scenario: Listmonk admin is accessible from the Services tab
    Given Listmonk is configured with LISTMONK_API_URL in .env
    When I visit "/ap-admin/services/email"
    Then the page embeds the Listmonk admin UI in an iframe

  Scenario: Subscriber endpoint forwards to Listmonk API via newsletterAdapter
    Given NEWSLETTER_DELIVERY_MODE is set to "listmonk" in the environment
    And LISTMONK_API_URL, LISTMONK_API_USERNAME, LISTMONK_API_PASSWORD, LISTMONK_LIST_ID are configured
    When a visitor submits their email to the newsletter signup endpoint
    Then the newsletterAdapter calls the Listmonk /api/subscribers endpoint with Basic auth
    And the visitor's email is subscribed to the configured list without any third-party SaaS involvement

  Scenario: Listmonk adapter returns error when configuration is incomplete
    Given NEWSLETTER_DELIVERY_MODE is "listmonk" but LISTMONK_API_URL is missing
    When a visitor submits their email
    Then the adapter returns ok: false with a user-facing error message

  Scenario: Import pipeline can extract WordPress subscribers
    Given a WordPress XML export contains subscriber metadata
    When the import runs with --import-subscribers
    Then a JSON file of subscribers is created in the artifact directory
    And a log entry notes how to bulk-import into Listmonk via its REST API

  Scenario: Listmonk service appears in scaffold prompts
    Given Listmonk email integration is available as an option
    When I run "astropress new my-site" and choose email integration
    Then "Listmonk" is presented as the default option
    And "Keila" is presented as an alternative

  Scenario: POST /ap/newsletter/subscribe returns 200 for valid email
    Given a valid email address is submitted to POST /ap/newsletter/subscribe
    When the newsletter adapter succeeds
    Then the response status is 200 with body { ok: true }

  Scenario: POST /ap/newsletter/subscribe returns 400 for invalid email
    Given an invalid email address is submitted to POST /ap/newsletter/subscribe
    When the endpoint validates the request
    Then the response status is 400 with body { ok: false }

  Scenario: POST /ap/newsletter/subscribe returns 422 on adapter error
    Given a valid email is submitted but the newsletter adapter returns an error
    When the endpoint processes the request
    Then the response status is 422 with body { ok: false }

  Scenario: Newsletter subscription records a conversion audit event
    Given a visitor subscribes to the newsletter via POST /ap/newsletter/subscribe
    When the subscription succeeds
    Then a "newsletter.subscribe" audit event is recorded with the email as resource_id

  Scenario: Conversion audit event includes utm_source when present in query string
    Given a visitor subscribes via a link with ?utm_source=homepage
    When the subscription succeeds
    Then the audit event summary references "homepage"
