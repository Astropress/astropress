Feature: Typed content type field definitions
  As a framework integrator
  I want to define typed custom fields for my content types via registerCms()
  So that save operations enforce field presence and validation rules at the server

  Background:
    Given registerCms() is called with a contentTypes array containing an "event" type
    And the "event" type has a required "eventDate" field and an optional "venue" field

  Scenario: Save is rejected when a required custom field is missing
    Given an "event" content record exists with templateKey "event"
    When a save is submitted with no metadata (or empty metadata)
    Then saveRuntimeContentState returns ok: false
    And the error message contains "eventDate" and "required"

  Scenario: Save succeeds when all required fields are provided
    Given an "event" content record exists with templateKey "event"
    When a save is submitted with metadata { eventDate: "2026-06-01", venue: "Main Hall" }
    Then saveRuntimeContentState returns ok: true
    And the metadata is persisted as JSON in the content_overrides.metadata column

  Scenario: Save succeeds when no contentType is registered for the templateKey
    Given a "page" content record exists with templateKey "page"
    And no contentType is registered for "page"
    When a save is submitted with no metadata
    Then saveRuntimeContentState returns ok: true (no field validation runs)

  Scenario: Custom validate function can reject a field value
    Given an "event" contentType with a "capacity" field that validates positive numbers
    When a save is submitted with metadata { eventDate: "2026-06-01", capacity: -5 }
    Then saveRuntimeContentState returns ok: false
    And the error message comes from the validate() return value

  Scenario: Admin form auto-generates inputs for registered content type fields
    Given a content type "event" is registered with fields: eventDate (text, required), venue (text), featured (boolean)
    When an admin opens the post editor for a post with templateKey "event"
    Then the editor renders a text input for "eventDate" with required attribute
    And the editor renders a text input for "venue" without required
    And the editor renders a checkbox input for "featured"
    And all input names follow the "metadata.{fieldName}" pattern

  Scenario: Admin form renders select inputs for select-type fields
    Given a content type "product" is registered with a "status" select field (options: draft, active, discontinued)
    When an admin opens the post editor for a post with templateKey "product"
    Then the editor renders a select element for "status" with the configured options
