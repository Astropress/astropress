Feature: Undo toast after deleting admin resources

  Scenario: Deleting a resource shows an undo toast
    Given I am logged in as an admin
    When I delete an author from the authors list
    Then I am redirected to the authors page with restore params in the URL
    And an undo toast is shown with an Undo button

  Scenario: Clicking Undo restores the deleted resource
    Given an undo toast is visible for a deleted author
    When I click the Undo button
    Then the restore action clears the deleted_at timestamp
    And I am redirected back to the authors page with restored=1

  Scenario: Undo toast auto-dismisses with CSS animation instead of JavaScript
    Given an undo toast is visible after deleting a resource
    When 8 seconds have elapsed
    Then the toast fades out using CSS animation without JavaScript setTimeout
