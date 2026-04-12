Feature: astropress list tools — display available tool options by category
  As a developer evaluating Astropress
  I want to run a single command that lists all integration options organised by category
  So that I can discover what data providers, app hosts, import sources, and integrations are available without reading external documentation

  Background:
    Given the AstroPress CLI is installed and available on the PATH

  Scenario: Developer runs astropress list tools and sees all categories
    When the developer runs "astropress list tools"
    Then the output contains a "Data Providers" section
    And the output contains an "App Hosts" section
    And the output contains an "Import Sources" section
    And the output contains an "Integrations" section

  Scenario: Data providers section lists all supported providers
    When the developer runs "astropress list tools"
    Then the Data Providers section lists "sqlite"
    And the Data Providers section lists "cloudflare"
    And the Data Providers section lists "supabase"
    And the Data Providers section lists "neon"
    And the Data Providers section lists "nhost"
    And the Data Providers section lists "pocketbase"
    And the Data Providers section lists "appwrite"
    And the Data Providers section lists "runway"

  Scenario: App Hosts section lists all supported deployment targets
    When the developer runs "astropress list tools"
    Then the App Hosts section lists "github-pages"
    And the App Hosts section lists "cloudflare-pages"
    And the App Hosts section lists "vercel"
    And the App Hosts section lists "netlify"
    And the App Hosts section lists "render-static"
    And the App Hosts section lists "render-web"
    And the App Hosts section lists "gitlab-pages"
    And the App Hosts section lists "runway"

  Scenario: Import Sources section lists all supported migration sources
    When the developer runs "astropress list tools"
    Then the Import Sources section lists "wordpress"
    And the Import Sources section lists "wix"

  Scenario: Integrations section lists tools grouped by add flag
    When the developer runs "astropress list tools"
    Then the Integrations section shows "--analytics" with options including "umami" and "posthog"
    And the Integrations section shows "--email" with "listmonk"
    And the Integrations section shows "--commerce" with options including "medusa" and "vendure"
    And the Integrations section shows "--forum" with options including "flarum"
    And the Integrations section shows "--notify" with options including "ntfy" and "gotify"
    And the Integrations section shows "--sso" with options including "authentik" and "zitadel"

  Scenario: Running astropress list without a subcommand returns an error
    When the developer runs "astropress list"
    Then the command exits with a non-zero status
    And the error message suggests "astropress list tools"

  Scenario: Running astropress list tools with an unknown extra argument returns an error
    When the developer runs "astropress list tools --unknown"
    Then the command exits with a non-zero status
    And the error identifies the unknown option
