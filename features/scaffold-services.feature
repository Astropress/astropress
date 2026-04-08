Feature: Service selection during astropress new
  As a developer creating a new AstroPress project
  I want to choose which optional services to include during scaffolding
  So that the project is wired up correctly from the start

  Scenario: Interactive mode presents CMS choices
    Given the --plain flag is not passed
    When I run "astropress new my-site"
    Then the CLI presents a CMS selection menu
    And options include "Keep AstroPress built-in", "Payload", "Keystatic", and "Directus"

  Scenario: Choosing Payload generates a payload.config.ts stub
    Given I select "Payload" for CMS during scaffolding
    When scaffolding completes
    Then the project directory contains "payload.config.ts"
    And the .env.example file contains "PAYLOAD_SECRET"

  Scenario: Choosing Keystatic generates a keystatic.config.ts stub
    Given I select "Keystatic" for CMS during scaffolding
    When scaffolding completes
    Then the project directory contains "keystatic.config.ts"

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

  Scenario: Plain mode uses defaults without prompting
    Given the --plain flag is passed
    When I run "astropress new my-site --plain"
    Then the CLI scaffolds with built-in content services
    And no interactive prompts are shown
