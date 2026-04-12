Feature: Concurrent content editing protection
  As a site editor
  I want to be warned when another admin has modified the same post after I opened it
  So that I do not accidentally overwrite their changes

  Background:
    Given an admin is signed in to the admin panel
    And a post titled "Annual Review" exists in the database

  Scenario: Save is rejected when the record was modified after the editor opened it (HTTP 409)
    Given Alice opens the post "Annual Review" and records its lastKnownUpdatedAt timestamp
    When another editor saves a newer version of the post
    And Alice submits her form with the original lastKnownUpdatedAt
    Then the save action returns HTTP 409 with a conflict error containing "modified by another editor"
    And Alice's changes are not persisted

  Scenario: Save succeeds when lastKnownUpdatedAt matches the current updated_at
    Given Alice opens the post "Annual Review" and reads its current updated_at
    When Alice submits her form with the matching lastKnownUpdatedAt
    Then the save action succeeds and her changes are applied

  Scenario: Save proceeds normally when no lastKnownUpdatedAt is provided
    Given Alice opens the post "Annual Review" without recording a lastKnownUpdatedAt
    When Alice submits her changes without a lastKnownUpdatedAt field
    Then the save action succeeds without conflict checking

  Scenario: Editor sees a warning when another admin is already editing the same post
    Given admin "alice@example.com" has the post "Annual Review" open in the editor
    When admin "bob@example.com" opens the same post in a separate session
    Then Bob sees a notice: "This post is currently being edited by alice@example.com"
