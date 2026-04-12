Feature: Switching and deploying across hosting providers
  As a developer
  I want to deploy the same project to different hosting providers
  So that I am not locked in to a single platform

  Scenario: A developer can move their site from one hosting provider to another by changing environment variables
    Given an AstroPress project deployed on Cloudflare
    When the developer updates the provider environment variables and redeploys
    Then the site runs on the new provider with the same content and admin panel

  Scenario: A deployed site connects to the right database based on environment variables alone
    Given the same AstroPress codebase is deployed to two different hosts with different database credentials
    When each host starts up
    Then each deployment connects to its own database without any code changes
