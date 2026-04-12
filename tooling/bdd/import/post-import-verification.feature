Feature: Post-import verification and telemetry
  As a developer using AstroPress CLI
  I want to verify the result of an import before committing
  So that I can catch problems and optionally report them to improve the tool

  Scenario: Happy path skips feedback entirely
    Given an import completes with 142 posts and 0 warnings
    When the user answers "Y" to the satisfaction prompt
    Then the CLI exits with code 0
    And no telemetry is sent

  Scenario: Choosing "c" triggers browser crawl
    Given an import completes successfully
    When the user answers "c" to the satisfaction prompt
    Then the page crawler runs with Playwright mode

  Scenario: Choosing "n" offers a multi-select feedback form
    Given an import completes successfully
    When the user answers "n" to the satisfaction prompt
    Then the CLI presents a multi-select list of issue categories

  Scenario: User declines to share feedback
    Given the user has answered "n" to satisfaction
    And the user has selected issue categories
    When the user answers "N" to the share-anonymously prompt
    Then no telemetry is sent
    And the CLI exits cleanly

  Scenario: User consents to share feedback
    Given the user has answered "n" to satisfaction
    And the user has selected issue categories
    When the user answers "y" to the share-anonymously prompt
    Then telemetry is posted with the selected issue codes and no PII

  Scenario: Consent is remembered so the prompt only appears once
    Given telemetry consent is already stored as "true" in ~/.astropress/config.json
    When an import completes and the user chooses "n"
    Then feedback is sent without asking for consent again

  Scenario: Plain mode skips all interactive prompts
    Given the --plain flag is passed
    When an import completes
    Then the CLI exits without displaying the satisfaction prompt
