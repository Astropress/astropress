Feature: New project setup with astropress new
  As a developer
  I want to scaffold a new AstroPress project for my chosen hosting provider
  So that I can start developing immediately without writing boilerplate configuration

  Scenario: A developer running astropress new gets pre-filled environment variables for their chosen provider
    Given the developer runs "astropress new" and selects a hosting provider
    When astropress writes the project files
    Then the .env and .env.example files contain correct variable names for that provider

  Scenario: A developer can start local development immediately after running astropress new
    Given a project has been scaffolded with "astropress new"
    When the developer runs "astropress dev" without editing any files
    Then the local site and admin panel are accessible at localhost

  Scenario: A developer creating a new project sees recommended hosting pairings matched to their chosen database
    Given the developer is running "astropress new" and selecting a database
    When astropress presents the hosting options
    Then the recommended app host is matched to the selected database provider

  Scenario: A developer gets a generated DEPLOY.md with deploy steps specific to their chosen hosting provider
    Given the developer has scaffolded a project for Vercel with Supabase
    When the project directory is created
    Then a DEPLOY.md file contains the correct deploy commands and required secrets for that combination
