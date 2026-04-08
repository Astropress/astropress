Feature: Organising content with categories and tags
  As a content editor
  I want to assign categories and tags to posts
  So that readers can browse related content and the site structure is clear

  Scenario: An editor assigns a category to a post and the post appears in that category's listing
    Given a category exists in the admin panel
    When the editor assigns that category to a post and publishes it
    Then the post appears in the category listing page for readers

  Scenario: An editor can add new taxonomy terms and remove obsolete ones
    Given the editor is on the taxonomy management page
    When they create a new tag and delete an unused one
    Then the new tag is available when editing posts and the deleted tag no longer appears in the list
