Feature: Donation Integrations
  As a site owner
  I want to configure donation providers through registerCms()
  So that visitors can donate using their preferred method

  Background:
    Given the site is deployed with the admin panel enabled

  Scenario: no donations configured returns empty snippets
    Given no donations are configured in the CMS registration
    When resolveDonationSnippets is called with undefined donations
    Then all snippet fields are empty strings

  Scenario: GiveLively config generates widget HTML
    Given donations are configured with GiveLively orgSlug "my-org"
    When resolveDonationSnippets is called with that config
    Then the giveLively snippet contains "give-lively-widget"
    And the giveLively snippet contains "my-org/my-org"

  Scenario: GiveLively with campaign slug uses campaign identifier
    Given donations are configured with GiveLively orgSlug "my-org" and campaignSlug "my-campaign"
    When resolveDonationSnippets is called with that config
    Then the giveLively snippet contains "my-org/my-campaign"

  Scenario: GiveLively without campaign slug falls back to org slug
    Given donations are configured with GiveLively orgSlug "my-org" and no campaign slug
    When resolveDonationSnippets is called with that config
    Then the giveLively snippet contains "my-org/my-org"

  Scenario: Liberapay config generates button HTML
    Given donations are configured with Liberapay username "myuser"
    When resolveDonationSnippets is called with that config
    Then the liberapay snippet contains "liberapay.com/myuser/donate"

  Scenario: PledgeCrypto config generates widget HTML
    Given donations are configured with PledgeCrypto partnerKey "pk_test_123"
    When resolveDonationSnippets is called with that config
    Then the pledgeCrypto snippet contains "plg-donate"
    And the pledgeCrypto snippet contains "pk_test_123"

  Scenario: PledgeCrypto generates head script tag
    Given donations are configured with PledgeCrypto partnerKey "pk_test_123"
    When resolveDonationSnippets is called with that config
    Then the pledgeCryptoHeadScript contains "pledge-widget.js"

  Scenario: GiveLively suppressed when DNT opted out
    Given donations are configured with GiveLively orgSlug "my-org"
    When resolveDonationSnippets is called with optedOut true
    Then the giveLively snippet is an empty string

  Scenario: PledgeCrypto suppressed when DNT opted out
    Given donations are configured with PledgeCrypto partnerKey "pk_test_123"
    When resolveDonationSnippets is called with optedOut true
    Then the pledgeCrypto snippet is an empty string
    And the pledgeCryptoHeadScript is an empty string

  Scenario: Liberapay not suppressed when DNT opted out
    Given donations are configured with Liberapay username "myuser"
    When resolveDonationSnippets is called with optedOut true
    Then the liberapay snippet contains "liberapay.com/myuser/donate"

  Scenario: multiple providers can be enabled simultaneously
    Given donations are configured with GiveLively, Liberapay, and PledgeCrypto
    When resolveDonationSnippets is called with that config
    Then the giveLively snippet is non-empty
    And the liberapay snippet is non-empty
    And the pledgeCrypto snippet is non-empty

  Scenario: JSON-LD DonateAction included when any provider enabled
    Given donations are configured with Liberapay username "myuser"
    When resolveDonationSnippets is called with siteUrl "https://example.com"
    Then the jsonLd field contains "DonateAction"
    And the jsonLd field contains "https://example.com/donate"

  Scenario: JSON-LD omitted when no providers configured
    Given no donations are configured in the CMS registration
    When resolveDonationSnippets is called with undefined donations
    Then the jsonLd field is an empty string

  Scenario: env example includes GiveLively keys when enabled
    Given the scaffold is configured with GiveLively enabled
    When buildDonationsEnvExample is called
    Then the result contains "GIVELIVELY_ORG_SLUG"

  Scenario: env example includes Liberapay key when enabled
    Given the scaffold is configured with Liberapay enabled
    When buildDonationsEnvExample is called
    Then the result contains "LIBERAPAY_USERNAME"

  Scenario: env example includes PledgeCrypto key when enabled
    Given the scaffold is configured with PledgeCrypto enabled
    When buildDonationsEnvExample is called
    Then the result contains "PLEDGE_PARTNER_KEY"

  Scenario: env example omits donation keys when none enabled
    Given the scaffold is configured with no donation providers
    When buildDonationsEnvExample is called
    Then the result is empty
