Feature: Generic inbound webhook receiver verifies HMAC signatures

  # The receiver routes /api/webhooks/[provider] requests through a
  # registered InboundWebhookProvider definition. Verification runs
  # over raw request bytes before any body parsing.

  Scenario: A correctly signed GitHub webhook returns 200 with the event name
    Given a registered "github" inbound webhook provider with X-Hub-Signature-256
    When a request arrives with a body signed under the configured secret
    Then receiveInboundWebhook returns ok with the parsed eventName

  Scenario: A request to an unregistered provider returns RECEIVER_UNKNOWN_PROVIDER
    Given no provider is registered for "stripe"
    When a request arrives at /api/webhooks/stripe
    Then receiveInboundWebhook returns ok=false with code "RECEIVER_UNKNOWN_PROVIDER"

  Scenario: A request with no signature header returns RECEIVER_MISSING_SIGNATURE
    Given a registered "github" inbound webhook provider
    When a request arrives without the X-Hub-Signature-256 header
    Then receiveInboundWebhook returns ok=false with code "RECEIVER_MISSING_SIGNATURE"

  Scenario: A request with a forged signature returns RECEIVER_INVALID_SIGNATURE
    Given a registered "github" inbound webhook provider
    When a request arrives with a signature computed under a different secret
    Then receiveInboundWebhook returns ok=false with code "RECEIVER_INVALID_SIGNATURE"

  Scenario: A request whose body has been tampered after signing returns RECEIVER_INVALID_SIGNATURE
    Given a request signed under the correct secret
    When the body is mutated before reaching the receiver
    Then receiveInboundWebhook returns ok=false with code "RECEIVER_INVALID_SIGNATURE"
