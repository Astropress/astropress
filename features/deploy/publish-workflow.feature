Feature: Publish to production via deploy hook

  Background:
    Given an Astropress admin panel is running

  Scenario: Admin triggers a production build via the Publish button
    Given the user is logged in as an admin
    And CF_PAGES_DEPLOY_HOOK_URL is set to a mock endpoint
    When the admin submits the publish action
    Then a POST request is sent to the Cloudflare Pages deploy hook
    And the response indicates the build was triggered

  Scenario: Publish button is hidden when no deploy hook is configured
    Given no deploy hook environment variables are set
    When the admin layout renders
    Then the Publish button is not shown

  Scenario: Non-admin cannot trigger a publish
    Given the user is logged in as an editor
    When the editor attempts to POST to /ap-admin/actions/publish
    Then the request is rejected with a forbidden response

  Scenario: GitHub Pages deploy hook fires a repository_dispatch event
    Given GH_TOKEN and GH_REPO are set in the environment
    When triggerPublish is called with type "github-actions"
    Then a POST is sent to the GitHub dispatches API endpoint
    And the event_type is "astropress-publish"

  Scenario: Cloudflare Pages deploy hook sends a POST to the deploy hook URL
    Given CF_PAGES_DEPLOY_HOOK_URL is set to "https://api.cloudflare.com/mock-hook"
    When triggerPublish is called with type "cloudflare-pages"
    Then a POST request is sent to "https://api.cloudflare.com/mock-hook"
