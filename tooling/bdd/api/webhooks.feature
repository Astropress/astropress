Feature: Webhook dispatch for real-time event notifications
  As a site administrator
  I want to register webhook endpoints that receive signed event payloads
  So that external systems are notified when content changes without polling the API

  Background:
    Given an Astropress admin panel is running
    And the site has API access enabled in its configuration

  Scenario: Admin registers a webhook for content publish events
    Given the user is logged in as an admin
    When the admin creates a webhook pointing to "https://example.com/hook" for event "content.published"
    Then a verification key bundle is displayed exactly once
    And the webhook is listed on the webhooks page

  Scenario: Webhook receives a signed payload when content is published
    Given a webhook is registered for event "content.published"
    When a piece of content is published via the REST API
    Then the webhook URL receives a POST request
    And the request includes an X-Astropress-Signature header with a valid ML-DSA-65 signature
    And the payload contains the published content record

  Scenario: Webhook failure does not block the originating operation
    Given a webhook is registered for event "content.published"
    And the webhook endpoint returns a 500 error
    When content is published
    Then the publish operation completes successfully
    And the webhook failure is logged but not surfaced to the caller

  Scenario: Deleted webhook no longer receives events
    Given a webhook is registered and then deleted by an admin
    When content is published
    Then the deleted webhook URL does not receive a request
