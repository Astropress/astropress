Feature: Operator connects, reverifies, and disconnects an integration provider

  # An admin manages per-domain integration providers (Phase 3) through
  # the connect-flow that wraps the provider registry's verify() callback
  # and the Phase 2 sealed-secret store. The flow surfaces typed error
  # codes on failure so the admin UI can show a localised hint.

  Scenario: Connecting a provider with valid credentials persists a sealed secret
    Given a registered provider for the "newsletter" domain
    When the admin POSTs valid fields to /ap-admin/actions/integration-connect
    Then connectIntegration calls repo.connect with the validated fields
    And the connect_flow returns ok with status="connected"

  Scenario: Connecting with a missing field returns INTEGRATION_VERIFY_FAILED
    Given a registered provider whose Zod schema requires "apiKey"
    When the admin POSTs without the apiKey field
    Then connect_flow returns ok=false with code "INTEGRATION_VERIFY_FAILED"
    And no row is written to integration_secrets

  Scenario: Reverifying a connected provider updates the status row
    Given a previously connected provider in the "newsletter" domain
    When the admin POSTs to /ap-admin/actions/integration-reverify with current fields
    Then repo.updateStatus is called with status="connected"

  Scenario: Disconnecting a provider removes its row
    Given a previously connected provider in the "newsletter" domain
    When the admin POSTs to /ap-admin/actions/integration-disconnect
    Then repo.disconnect is called with the (domain, providerId) pair

  Scenario: Connect on a host without the integrations repo returns INTEGRATIONS_NOT_AVAILABLE
    Given the host's local admin store does not expose integrations
    When the admin POSTs to /ap-admin/actions/integration-connect
    Then connectIntegrationAction returns ok=false with code "INTEGRATIONS_NOT_AVAILABLE"
