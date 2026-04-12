Feature: astropress add — add integrations to an existing project
  As a developer
  I want to add optional integrations to an existing Astropress project
  So that I can extend the project without re-scaffolding

  Scenario: astropress add --analytics umami appends env stubs to .env.example
    Given an existing Astropress project directory
    When I run "astropress add --analytics umami"
    Then .env.example contains UMAMI_URL and UMAMI_WEBSITE_ID

  Scenario: astropress add --email listmonk generates LISTMONK.md and middleware
    Given an existing Astropress project directory
    When I run "astropress add --email listmonk"
    Then LISTMONK.md is written to the project root
    And src/middleware.ts is updated with registerAstropressService

  Scenario: astropress add --forum flarum appends env stubs to .env.example
    Given an existing Astropress project directory
    When I run "astropress add --forum flarum"
    Then .env.example contains FLARUM_URL and FLARUM_API_KEY

  Scenario: astropress add --notify gotify appends env stubs to .env.example
    Given an existing Astropress project directory
    When I run "astropress add --notify gotify"
    Then .env.example contains GOTIFY_URL and GOTIFY_APP_TOKEN

  Scenario: astropress add --schedule calcom appends env stubs to .env.example
    Given an existing Astropress project directory
    When I run "astropress add --schedule calcom"
    Then .env.example contains CALCOM_API_URL and CALCOM_API_KEY

  Scenario: astropress add --commerce vendure appends env stubs to .env.example
    Given an existing Astropress project directory
    When I run "astropress add --commerce vendure"
    Then .env.example contains VENDURE_API_URL

  Scenario: astropress add --chat tiledesk appends env stubs to .env.example
    Given an existing Astropress project directory
    When I run "astropress add --chat tiledesk"
    Then .env.example contains TILEDESK_API_URL and TILEDESK_PROJECT_ID

  Scenario: astropress add with an unrecognised flag returns a clear error
    Given any project directory
    When I run "astropress add --unknown-feature foo"
    Then the command exits with a non-zero status
    And the error message identifies the unknown flag

  Scenario: astropress add to a directory that does not exist returns an error
    Given a path that does not exist on the filesystem
    When I run "astropress add" pointing at that path
    Then the command exits with a non-zero status
    And the error message states the directory was not found
