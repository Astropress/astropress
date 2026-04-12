Feature: Scheduled content publishing
  As a content editor
  I want to schedule a post or page to publish at a specific future date and time
  So that content goes live automatically without requiring me to be at my computer

  Background:
    Given an Astropress admin panel is running
    And the user is logged in as an editor

  Scenario: Editor schedules a post for future publication
    Given a post exists in draft status
    When the editor sets a publish date and time in the future and saves
    Then the post status remains "draft" but displays as "Scheduled"
    And the scheduled publish time is shown on the post list

  Scenario: Scheduler publishes content when its scheduled time arrives
    Given a post is scheduled to publish at a specific time
    When the astropress scheduler runs at or after that time
    Then the post status changes to "published"
    And the post is publicly accessible

  Scenario: Editor can cancel a scheduled publish
    Given a post is in scheduled state
    When the editor removes the scheduled publish date
    Then the post reverts to plain draft status
    And no scheduled time is shown

  Scenario: Scheduling a post does not immediately publish it
    Given a post exists in draft status
    When the editor schedules it for a time in the future
    Then the post is not yet publicly visible
    And its status is still reported as "draft" with a scheduled_at field set
