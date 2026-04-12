Feature: Admin dashboard overview
  As a site administrator
  I want a summary view when I first open the admin panel
  So that I can quickly assess the state of my site without navigating between sections

  Background:
    Given an admin is signed in to the admin panel

  Scenario: Dashboard displays site activity summary on first load
    Given the panel has content, users, and recent activity
    When the admin navigates to the dashboard
    Then they see a summary of published content count, pending comments count, and recent actions
