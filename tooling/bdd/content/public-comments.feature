Feature: Public comment submission
  As a reader
  I want to leave a comment on a post
  So that I can share my thoughts and participate in discussions on the site

  Scenario: A reader submits a comment on a post and it enters the moderation queue
    Given a reader has written a comment on a published post
    When they submit the comment form
    Then the comment is saved in a pending state awaiting moderator review
