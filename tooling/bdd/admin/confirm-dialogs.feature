Feature: Destructive actions ask for confirmation before proceeding
  As an admin managing site content
  I want to confirm before deleting or revoking resources
  So that I do not accidentally lose data

  Scenario: Admin confirms before deleting an author
    Given I am signed in as an admin on the authors page
    When I click "Delete" on an author row
    Then a confirmation dialog opens showing the author name
    And the author is not deleted until I confirm

  Scenario: Admin confirms before deleting a category
    Given I am signed in as an admin on the taxonomies page
    When I click "Delete" on a category row
    Then a confirmation dialog opens before the category is removed

  Scenario: Admin confirms before deleting a tag
    Given I am signed in as an admin on the taxonomies page
    When I click "Delete" on a tag row
    Then a confirmation dialog opens before the tag is removed

  Scenario: Admin confirms before deleting a media asset
    Given I am signed in as an admin on the media page
    When I click "Delete" on a media asset
    Then a confirmation dialog opens before the asset is removed

  Scenario: Admin confirms before deleting a webhook
    Given I am signed in as an admin on the webhooks page
    When I click "Delete" on a webhook row
    Then a confirmation dialog opens showing the webhook URL

  Scenario: Admin confirms before revoking an API token
    Given I am signed in as an admin on the API tokens page
    When I click "Revoke" on an active token
    Then a confirmation dialog warns that integrations will stop working

  Scenario: Admin confirms before suspending a user
    Given I am signed in as an admin on the users page
    When I click "Suspend" on an active user
    Then a confirmation dialog opens explaining the user will be locked out

  Scenario: Admin confirms before purging user data
    Given I am signed in as an admin on the users page
    When I click "Purge & Download Report"
    Then a confirmation dialog warns that the action cannot be undone

  Scenario: Admin confirms before removing a subscriber
    Given I am signed in as an admin on a subscriber detail page
    When I click "Remove subscriber"
    Then a confirmation dialog warns that the action cannot be undone

  Scenario: Submitting a form disables the button to prevent duplicate actions
    Given I am signed in as an admin
    When I submit a form
    Then the submit button becomes unclickable until the page responds
