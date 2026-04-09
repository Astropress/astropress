Feature: Content service health checks and diagnostics
  As a site operator
  I want to verify that all required services are running and correctly configured
  So that I can catch problems before they affect readers

  Background:
    Given the AstroPress CLI is installed and available on the PATH
    And an Astropress project exists in the current directory

  Scenario: An operator verifies that content services are reachable before going live
    Given the project has a configured database and content service
    When the operator runs "astropress services verify"
    Then each service reports whether it is connected and ready

  Scenario: An operator is told exactly which environment variables are missing
    Given a required database environment variable is absent from the project
    When the operator runs "astropress doctor"
    Then the output names every missing variable and explains how to set it

  Scenario: An operator is warned when admin passwords are still set to weak placeholder values
    Given the .env file contains a scaffolded placeholder password
    When the operator runs "astropress doctor --strict"
    Then the command exits with a warning that the password must be replaced before going live
