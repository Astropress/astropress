Feature: Stale tab warning for concurrent admin editing
  As an admin editor
  I want to be warned when another browser tab is editing the same post
  So that I do not accidentally overwrite another editor's in-progress changes

  Background:
    Given an Astropress admin panel is running
    And the user is logged in as an admin

  Scenario: Editor sees a stale-tab warning when another admin tab is editing the same post
    Given the post editor is open in Tab A for the post "hello-world"
    When Tab B opens the same post "hello-world" in the admin panel
    Then Tab A shows a warning "Another tab is editing this post. Save your changes first before switching tabs."

  Scenario: Stale-tab warning is cleared when the competing tab is closed
    Given Tab A has a stale-tab warning for post "hello-world"
    When Tab B closes its editor for "hello-world"
    Then the stale-tab warning in Tab A is dismissed

  Scenario: Editor sees a stale-session warning when the page has been open too long
    Given the post editor for "hello-world" has been open for longer than the session TTL
    When the TTL timer fires
    Then the editor shows a warning "This page has been open over an hour. Reload before saving to avoid overwriting recent changes."
