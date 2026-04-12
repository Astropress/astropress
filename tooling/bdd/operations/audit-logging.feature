Feature: Admin action audit logging
  As a site administrator
  I want every content change to be recorded with who made it and when
  So that I can review the history of changes and hold contributors accountable

  Background:
    Given an admin is signed in to the admin panel
    And the audit log is enabled

  Scenario: Publishing a post creates an audit log entry
    Given a draft post titled "New Announcement" exists
    When the admin changes the post status to "published" and saves
    Then an audit log entry is created with action "content.publish", the post slug, and the admin's email
    And the entry timestamp matches the current time within 5 seconds

  Scenario: Inviting a new user creates an audit log entry
    When the admin invites "neweditor@example.com" as an editor
    Then an audit log entry is created with action "user.invite" and resource "neweditor@example.com"

  Scenario: Audit log entries are immutable once written
    Given an audit log entry exists for a recent content change
    When an admin attempts to delete or modify that entry via the admin panel
    Then the action is rejected and the entry remains unchanged

  Scenario: Audit log is visible to admins but not to editors
    Given an audit log has entries from the past 7 days
    When an admin opens the audit log section
    Then all entries are visible with user, action, resource, and timestamp columns
    When an editor attempts to access the audit log URL directly
    Then they receive a 403 Forbidden response

  Scenario: Audit log entries older than auditRetentionDays are pruned on each write
    Given auditRetentionDays is configured to 30 in registerCms
    And an audit entry exists with created_at 31 days ago
    When a new audit event is written
    Then the stale entry is automatically deleted and only the new entry remains
