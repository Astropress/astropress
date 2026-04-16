Feature: WCAG 2.2 AA accessibility compliance

  Scenario: All static admin routes pass axe WCAG 2.2 AA audit
    Given the admin harness dev server is running
    When axe-core scans every static admin route with WCAG 2.2 AA tags
    Then zero violations are reported on any route

  Scenario: All public example routes pass axe WCAG 2.2 AA audit
    Given the example site is built and served
    When axe-core scans every public route with WCAG 2.2 AA tags
    Then zero violations are reported on any route

  Scenario: Admin panel meets keyboard navigation requirements
    Given the admin harness dev server is running
    When the user presses Tab on any admin page
    Then focus moves to an interactive element

  Scenario: Admin pages have correct heading hierarchy
    Given the admin harness dev server is running
    When any admin page renders
    Then the page contains exactly one h1 element
    And heading levels do not skip (no h1 followed by h3)

  Scenario: Form controls have accessible names
    Given the admin harness dev server is running
    When any admin page with forms renders
    Then every input, select, and textarea has an associated label or aria-label

  Scenario: Color contrast meets WCAG 2.2 AA thresholds
    Given the admin CSS is loaded
    When axe-core evaluates color-contrast rules
    Then all text meets 4.5:1 ratio for normal text
    And all large text meets 3:1 ratio
