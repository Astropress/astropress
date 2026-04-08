Feature: Content persistence across editor sessions
  As a content editor
  I want my changes to be saved reliably
  So that I never lose work when I navigate away or the session ends

  Scenario: An editor's post status change is saved and immediately visible to all admin users
    Given a post is in draft state in the admin panel
    When the editor publishes the post
    Then any other admin who opens the post sees it as published

  Scenario: An admin can see the file size of each uploaded image in the media library
    Given an image has been uploaded to the media library
    When the admin opens the media panel
    Then the image entry shows its file size in bytes
