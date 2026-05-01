Feature: Visual page editor with sections and templates

  Scenario: Operator picks a landing template and sees pre-filled sections
    Given the section schema and templates module are available
    When the operator chooses the landing template
    Then the editor pre-fills hero, feature-grid, testimonials, and cta-banner sections

  Scenario: Section payload validates structurally before save
    Given an unparsed sections payload
    When parseSections runs over it
    Then unknown kinds, missing required fields, and malformed CTAs are reported with a path-keyed error

  Scenario: HTML-bearing sections are sanitised at save time
    Given a rich-text section containing a script tag
    When sanitizeSections processes the payload
    Then the script tag is stripped before persistence

  Scenario: Preview renderer escapes plain-text fields
    Given a hero section whose headline contains an img onerror payload
    When renderSectionsDocument produces the preview HTML
    Then the payload is HTML-escaped and not executable

  Scenario: Section editor seeds the hidden input from initial state
    Given an ap-section-editor with a single hero section
    When the component is connected to the DOM
    Then the hidden sectionsJson input contains the seeded section

  Scenario: Editing a section field updates the serialised payload
    Given an ap-section-editor with a hero section
    When the operator changes the headline input
    Then the hidden sectionsJson input reflects the new headline
