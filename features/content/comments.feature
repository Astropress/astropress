Feature: Comment moderation
  As a site moderator
  I want to review and manage reader comments from the admin panel
  So that I can keep discussions constructive and free of spam

  Scenario: A moderator approves a pending reader comment so it appears on the post
    Given a reader has posted a comment that is awaiting approval
    When the moderator approves the comment in the admin comments panel
    Then the comment becomes visible to all readers on that post

  Scenario: A moderator rejects a spam comment so it is removed
    Given a comment in the moderation queue has been identified as spam
    When the moderator rejects it in the admin comments panel
    Then the comment is removed and no longer visible to readers

  Scenario: A moderator can manage comments through the package-owned comment repository
    Given comments have been submitted across multiple posts
    When the moderator uses the admin panel to list and update comment records
    Then all changes are persisted through the AstroPress comment repository
