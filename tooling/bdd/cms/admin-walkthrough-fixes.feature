Feature: Pre-alpha walkthrough — UX regression guards

  Scenario: Live preview stylesheet is served as text/css
    Given the admin runtime is up
    When a request hits /sections.css
    Then the response status is 200 and the content-type is text/css

  Scenario: Section editor is reachable from the Pages list for structured pages
    Given the admin harness has seeded a structured page
    When the operator opens /ap-admin/pages and clicks the structured page edit link
    Then the section editor renders as the first card on the editor screen

  Scenario: Section editor card heading reads "Sections" not "Sections JSON"
    Given an operator on the route-page editor
    When the editor renders the section card
    Then the visible heading is the localised "Sections" label

  Scenario: New page creates without filling SEO fields
    Given an operator on /ap-admin/pages/new
    When the operator submits with only Title and Public path filled
    Then the create action accepts the submission and SEO inputs carry no required attribute

  Scenario: Admin URL warning leaves whitespace around inline code tokens
    Given the route-pages settings panel is rendered
    When the field-note containing inline code is computed
    Then the inline-margin around the code element is non-zero

  Scenario: Operator switches admin to Arabic and the page emits dir=rtl with bidi-plaintext
    Given the operator sets the admin locale cookie to ar
    When the dashboard renders
    Then document.documentElement carries dir=rtl and body copy uses unicode-bidi plaintext

  Scenario: Add-section dialog renders all four templates
    Given the section editor is open on a structured page
    When the operator clicks Add section
    Then the dialog renders the blank, landing, about, and contact templates

  Scenario: Add-section dialog renders all eight section kinds with localised labels
    Given the section editor add dialog is open
    When the kind picker is rendered
    Then every section kind renders with a non-key label

  Scenario: Live preview iframe references the served sections stylesheet
    Given an operator on the route-page editor
    When the page renders
    Then the ap-page-preview element references /sections.css and the URL responds 200

  Scenario: Mobile topbar wraps so brand and identity do not overlap at 375px
    Given the admin renders at a 375px viewport
    When the topbar lays out
    Then the brand and the identity meta block either stack or do not horizontally overlap

  Scenario: Mobile hamburger toggle is visible at 375px and meets WCAG 2.5.5
    Given the admin renders at a 375px viewport
    When the topbar lays out
    Then the data-nav-toggle button is visible and at least 44 by 44 CSS pixels
