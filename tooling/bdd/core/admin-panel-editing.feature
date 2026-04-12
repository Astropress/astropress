Feature: Non-technical admin can edit the site from the admin panel
  As a non-technical site admin
  I want to manage all content and site settings from one place
  So that I never need to touch code or a terminal

  Background:
    Given an admin is signed in to the admin panel

  Scenario: Admin edits and publishes a post from the admin panel
    Given a draft post titled "Hello World" exists
    When the admin edits the title to "Welcome to Our Site", sets the body to "<p>Updated body content</p>", sets the SEO title to "Welcome SEO", and changes the publish state to "published"
    Then the updated post is visible in the editor preview with title "Welcome to Our Site"
    And the post is publicly accessible at its slug

  Scenario: Admin manages redirects and uploads media from the same admin panel
    Given the admin panel is fully configured
    When the admin opens the media library and uploads a PNG file
    And the admin navigates to Redirects and adds a redirect from "/old" to "/new"
    Then both the uploaded image and the new redirect appear in their respective lists
    And neither step required provider-specific setup
