Feature: Publishing a site to a hosting provider
  As a developer
  I want to deploy my AstroPress site to a hosting provider
  So that my content is publicly accessible on the web

  Scenario: A developer deploying to GitHub Pages gets a generated Actions workflow
    Given a project is scaffolded with GitHub Pages as the app host
    When the developer pushes to their main branch
    Then the generated GitHub Actions workflow builds and publishes the site automatically

  Scenario: A developer deploying to Vercel or Cloudflare Pages uses provider-specific deploy scripts
    Given a project is configured for Vercel or Cloudflare Pages
    When the developer runs the provider deploy script
    Then the site is built and published using the correct provider CLI

  Scenario: A developer can see which hosting and database combinations are fully supported
    Given the developer is choosing a hosting provider and database combination
    When they check the AstroPress deployment matrix
    Then they see clearly which pairings are first-class supported and which are community-supported
