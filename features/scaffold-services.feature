Feature: Service selection during astropress new
  As a developer creating a new AstroPress project
  I want to choose which optional services to include during scaffolding
  So that the project is wired up correctly from the start

  # CMS / content backend

  Scenario: Interactive mode presents CMS choices
    Given the --plain flag is not passed
    When I run "astropress new my-site"
    Then the CLI presents a content backend selection menu
    And options include "AstroPress built-in", "Payload", "Keystatic", and "Directus"

  Scenario: Choosing Payload generates a payload.config.ts stub
    Given I select "Payload" for content backend during scaffolding
    When scaffolding completes
    Then the project directory contains "payload.config.ts"
    And the .env.example file contains "PAYLOAD_SECRET"

  Scenario: Choosing Keystatic generates a keystatic.config.ts stub
    Given I select "Keystatic" for content backend during scaffolding
    When scaffolding completes
    Then the project directory contains "keystatic.config.ts"

  Scenario: Choosing Directus generates env stubs
    Given I select "Directus" for content backend during scaffolding
    When scaffolding completes
    Then the .env.example file contains "DIRECTUS_URL"
    And the .env.example file contains "DIRECTUS_TOKEN"

  Scenario: Choosing Medusa generates a medusa-config.js stub
    Given I select "Medusa" for commerce during scaffolding
    When scaffolding completes
    Then the project directory contains "medusa-config.js"
    And the .env.example file contains "MEDUSA_BACKEND_URL"

  Scenario: Choosing Listmonk generates env entries
    Given I select "Listmonk" for email during scaffolding
    When scaffolding completes
    Then the .env.example file contains "LISTMONK_API_URL"
    And the .env.example file contains "LISTMONK_API_TOKEN"

  Scenario: Choosing Formbricks generates testimonial env entries
    Given I select "Formbricks" for testimonials during scaffolding
    When scaffolding completes
    Then the .env.example file contains "FORMBRICKS_API_KEY"
    And the .env.example file contains "FORMBRICKS_ENVIRONMENT_ID"

  Scenario: Choosing Frappe LMS generates course env entries
    Given I select "Frappe LMS" for courses during scaffolding
    When scaffolding completes
    Then the .env.example file contains "FRAPPE_LMS_URL"
    And the .env.example file contains "FRAPPE_LMS_API_KEY"

  Scenario: Choosing Polar generates donation env entries
    Given I select "Polar" for donations during scaffolding
    When scaffolding completes
    Then the .env.example file contains "POLAR_ACCESS_TOKEN"
    And the .env.example file contains "POLAR_ORGANIZATION_ID"

  Scenario: Choosing Flarum generates forum env entries
    Given I select "Flarum" for forum during scaffolding
    When scaffolding completes
    Then the .env.example file contains "FLARUM_URL"
    And the .env.example file contains "FLARUM_API_KEY"

  Scenario: Choosing Chatwoot generates live chat env entries
    Given I select "Chatwoot" for live chat during scaffolding
    When scaffolding completes
    Then the .env.example file contains "CHATWOOT_URL"
    And the .env.example file contains "CHATWOOT_API_ACCESS_TOKEN"
    And the .env.example file contains "CHATWOOT_INBOX_ID"

  Scenario: Choosing HyperSwitch generates payment router env entries
    Given I select "HyperSwitch" for payments during scaffolding
    When scaffolding completes
    Then the .env.example file contains "HYPERSWITCH_API_KEY"
    And the .env.example file contains "HYPERSWITCH_BASE_URL"
    And the .env.example file contains "PAYMENT_SUCCESS_REDIRECT_URL"

  Scenario: HyperSwitch env stubs document supported payment providers
    Given I select "HyperSwitch" for payments during scaffolding
    When scaffolding completes
    Then the .env.example file mentions "Razorpay" for UPI and India
    And the .env.example file mentions "M-PESA"

  Scenario: Choosing ntfy generates push notification env entries
    Given I select "ntfy" for push notifications during scaffolding
    When scaffolding completes
    Then the .env.example file contains "NTFY_URL"
    And the .env.example file contains "NTFY_TOPIC"

  Scenario: Choosing Rallly generates scheduling env entries
    Given I select "Rallly" for scheduling during scaffolding
    When scaffolding completes
    Then the .env.example file contains "RALLLY_URL"

  Scenario: Choosing job board scaffolds a content type stub
    Given I enable the job board option during scaffolding
    When scaffolding completes
    Then the project directory contains "content-types.example.ts"
    And the file contains "jobListingContentType"

  Scenario: PostHog selected for analytics pre-selects PostHog for session replay
    Given I select "PostHog" for analytics during scaffolding
    When the session replay prompt is shown
    Then the default selection is "PostHog" rather than "OpenReplay"

  Scenario: Plain mode uses defaults without prompting
    Given the --plain flag is passed
    When I run "astropress new my-site --plain"
    Then the CLI scaffolds with built-in content services
    And no interactive prompts are shown
