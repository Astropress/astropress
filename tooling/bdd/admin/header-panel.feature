Feature: Collapsible header utility panel

  Scenario: Topbar shows a collapse arrow button to the left of sign out
    Given I am signed in as an admin
    When I view any admin page
    Then the topbar contains a button with a left arrow icon
    And the theme toggle, language select, and keyboard shortcut button are hidden in the panel

  Scenario: Clicking the arrow reveals the utility panel with three buttons
    Given I am signed in as an admin
    When I click the collapse arrow button
    Then a panel slides out containing theme, language, and keyboard shortcut buttons

  Scenario: Theme toggle uses SVG icons instead of Unicode characters
    Given I am signed in as an admin
    When the utility panel is visible
    Then the theme toggle shows an SVG sun icon in dark mode
    And the theme toggle shows an SVG moon icon in light mode
