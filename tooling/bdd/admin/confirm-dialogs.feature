Feature: Destructive actions require styled confirmation dialogs

  Scenario: Authors page shows confirm dialog before deleting an author
    Given I am signed in as an admin
    When I click "Delete" on an author row
    Then a styled dialog opens asking to confirm the deletion
    And the dialog contains Cancel and Delete buttons
    And the author is not deleted until the dialog is confirmed

  Scenario: Taxonomies page shows confirm dialog before deleting a category
    Given I am signed in as an admin
    When I click "Delete" on a category row
    Then a styled dialog opens asking to confirm deletion of the category

  Scenario: Taxonomies page shows confirm dialog before deleting a tag
    Given I am signed in as an admin
    When I click "Delete" on a tag row
    Then a styled dialog opens asking to confirm deletion of the tag

  Scenario: Media page shows confirm dialog before deleting an asset
    Given I am signed in as an admin
    When I click "Delete" on a media asset
    Then a styled dialog opens asking to confirm deletion of the media asset

  Scenario: Webhooks page shows confirm dialog before deleting a webhook
    Given I am signed in as an admin
    When I click "Delete" on a webhook row
    Then a styled dialog opens asking to confirm deletion of the webhook

  Scenario: API Tokens page shows confirm dialog before revoking a token
    Given I am signed in as an admin
    When I click "Revoke" on an active token row
    Then a styled dialog opens asking to confirm revocation

  Scenario: Users page uses styled dialog instead of browser confirm for suspend
    Given I am signed in as an admin
    When I click "Suspend" on an active user
    Then a styled dialog opens instead of a browser confirm prompt

  Scenario: Users page uses styled dialog instead of browser confirm for GDPR purge
    Given I am signed in as an admin
    When I click "Purge & Download Report"
    Then a styled dialog opens instead of a browser confirm prompt

  Scenario: Subscriber detail uses styled dialog instead of browser confirm
    Given I am signed in as an admin
    When I click "Remove subscriber" on the subscriber detail page
    Then a styled dialog opens instead of a browser confirm prompt

  Scenario: Form submit buttons show loading state to prevent double submission
    Given I am signed in as an admin
    When I submit any admin form
    Then the submit button text changes to indicate loading
    And the submit button becomes disabled to prevent double submission
