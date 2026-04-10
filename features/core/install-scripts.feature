Feature: Install script environment setup
  As a developer or operator running the astropress install script
  I want the script to create a project .env with generated secrets and install dependencies
  So that the project is ready to run immediately after cloning

  Scenario: Install script creates project .env with generated secrets
    Given a fresh project directory with no .env file
    When the install script runs
    Then a .env file is created containing generated values for SESSION_SECRET, ADMIN_PASSWORD, and EDITOR_PASSWORD

  Scenario: Install script runs bun install in the project directory
    Given a fresh project directory with a valid package.json
    When the install script runs
    Then bun install is executed in the project directory and node_modules are present

  Scenario: Install script exits non-zero on missing bun
    Given bun is not available on the PATH
    When the install script runs
    Then the script exits with a non-zero status code and prints an error message
