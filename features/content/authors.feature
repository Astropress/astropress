Feature: Author management
  As a site administrator
  I want to manage author profiles from the admin panel
  So that contributors can be properly credited for the content they write

  Background:
    Given an admin is signed in to the admin panel

  Scenario: An admin creates a new author profile so they can be credited on posts
    When they create a new author profile with a name and bio
    Then the author is saved and available for assignment to content

  Scenario: An admin updates an existing author's bio after they change their byline
    Given an author profile "Jane Doe" already exists in the system
    When the admin edits the author's name to "Jane Smith" and bio and saves the changes
    Then the updated name "Jane Smith" is persisted and reflected across assigned posts

  Scenario: An admin removes an author who has left the organisation
    Given an author profile "Former Employee" exists that is no longer needed
    When the admin deletes the author from the panel
    Then the author is removed from the system and the action is recorded in the audit log
