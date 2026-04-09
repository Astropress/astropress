Feature: Admin dashboard overview
  As a site administrator
  I want a summary view when I first open the admin panel
  So that I can quickly assess the state of my site without navigating between sections

  Scenario: An admin sees a summary of site activity when they open the admin panel
    Given the admin panel is configured with content, users, and recent activity
    When an admin navigates to the dashboard
    Then they see a summary of published content, pending comments, and recent actions
