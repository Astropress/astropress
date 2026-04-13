Feature: astropress list providers — display supported hosting and data service providers
  As a developer choosing a deployment stack
  I want to run a single command that lists all supported app hosts and data services
  So that I can understand which providers are available and how they can be combined

  Background:
    Given the AstroPress CLI is installed and available on the PATH

  Scenario: Developer runs astropress list providers and sees host categories
    When the developer runs "astropress list providers"
    Then the output contains an "App Hosts" section
    And the output contains a "Static" category under App Hosts
    And the output contains a "Server" category under App Hosts

  Scenario: Developer runs astropress list providers and sees data service categories
    When the developer runs "astropress list providers"
    Then the output contains a "Data Services" section
    And the output contains a "Serverless Postgres" category
    And the output contains a "Self-hosted BaaS" category

  Scenario: App Hosts section lists all supported deployment targets
    When the developer runs "astropress list providers"
    Then the App Hosts section lists "github-pages"
    And the App Hosts section lists "cloudflare-pages"
    And the App Hosts section lists "vercel"
    And the App Hosts section lists "netlify"
    And the App Hosts section lists "render-static"
    And the App Hosts section lists "render-web"
    And the App Hosts section lists "gitlab-pages"
    And the App Hosts section lists "runway"

  Scenario: Data Services section lists all supported providers
    When the developer runs "astropress list providers"
    Then the Data Services section lists "cloudflare"
    And the Data Services section lists "supabase"
    And the Data Services section lists "neon"
    And the Data Services section lists "nhost"
    And the Data Services section lists "pocketbase"
    And the Data Services section lists "appwrite"
    And the Data Services section lists "none"

  Scenario: Recommended pairings section lists best-supported combinations
    When the developer runs "astropress list providers"
    Then the output contains a "Recommended pairings" section
    And the output lists the "github-pages + none" pairing
    And the output lists the "cloudflare-pages + cloudflare" pairing
    And the output lists the "vercel + supabase" pairing
    And the output lists the "runway + runway" pairing

  Scenario: ls providers is an alias for list providers
    When the developer runs "astropress ls providers"
    Then the output contains an "App Hosts" section
    And the output contains a "Data Services" section

  Scenario: Running astropress list providers with an unknown extra argument returns an error
    When the developer runs "astropress list providers --unknown"
    Then the command exits with a non-zero status
    And the error identifies the unknown option
