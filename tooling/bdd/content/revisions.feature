Feature: Content revision history
  As a site editor
  I want to access and restore previous versions of my content
  So that I can undo mistakes and review how a post has changed over time

  Scenario: An editor can view the full revision history of a post before publishing
    Given a post has been saved multiple times with different content
    When the editor opens the revision history for that post
    Then each previous version is listed with the timestamp and author of each change

  Scenario: An admin restores a previous content revision to undo unwanted changes
    Given a post has been edited in a way that introduced an error
    When the admin selects an earlier revision and restores it
    Then the post content reverts to that version and the restoration is recorded
