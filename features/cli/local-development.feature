Feature: Local development server
  As a developer
  I want to run the site locally before deploying
  So that I can preview content changes and test the admin panel without affecting the live site

  Scenario: A developer starts the local preview server with a single command
    Given a project has been scaffolded with "astropress new"
    When the developer runs "astropress dev"
    Then the "dev" subcommand is recognised and the local server starts

  Scenario: A developer sees the admin credentials in the terminal on first run
    Given a freshly scaffolded project has not yet been visited
    When the developer runs "astropress new" to completion
    Then the terminal shows the admin login URL, email, and generated password

  Scenario: The CLI accepts a deploy target override from the environment
    Given the ASTROPRESS_DEPLOY_TARGET environment variable is set to a specific provider
    When the developer runs any astropress command
    Then the resolved deploy target matches the environment variable rather than the default
