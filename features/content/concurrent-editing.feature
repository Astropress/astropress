Feature: Concurrent content editing protection
  As a site editor
  I want to be warned when another admin is editing the same post
  So that I do not accidentally overwrite their changes

  Background:
    Given an admin is signed in to the admin panel
    And a post titled "Annual Review" exists in the database

  Scenario: Editor sees a warning when another admin is already editing the same post
    Given admin "alice@example.com" has the post "Annual Review" open in the editor
    When admin "bob@example.com" opens the same post in a separate session
    Then Bob sees a notice: "This post is currently being edited by alice@example.com"

  Scenario: Last save wins and the editor is shown a conflict notice
    Given both Alice and Bob have the post open and have made different edits
    When Alice saves first and Bob saves second
    Then Bob's save succeeds with his changes applied
    And Bob is shown a notice: "Your changes were saved. A previous version by alice@example.com was overwritten."

  Scenario: Editing lock is released when the original editor closes the post
    Given Alice has the post open and Bob sees the editing warning
    When Alice closes the editor without saving
    Then the editing notice disappears for Bob within 30 seconds
    And Bob can edit the post without a conflict warning
