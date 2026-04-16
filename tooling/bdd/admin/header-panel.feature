Feature: Header utility panel for quick-access controls
  As an admin using the panel daily
  I want theme, language, keyboard, and scroll controls tucked away
  So that the topbar stays clean while the tools remain one click away

  Scenario: Topbar keeps utility controls behind a single toggle
    Given I am signed in as an admin
    When I view any admin page
    Then the topbar shows a toggle button to the left of sign out
    And the theme, language, keyboard shortcut, and scroll controls are hidden until I open it

  Scenario: Opening the toggle reveals four utility buttons
    Given I am signed in as an admin
    When I click the utility panel toggle
    Then a panel appears with buttons for theme, language, keyboard shortcuts, and scroll

  Scenario: Theme toggle icon reflects the mode it will switch to
    Given I am viewing the admin panel in dark mode
    When I open the utility panel
    Then the theme button shows a sun icon indicating it will switch to light mode

  Scenario: Panel closes when I click outside or press Escape
    Given the utility panel is open
    When I click outside the panel or press Escape
    Then the panel closes

  Scenario: Scroll button takes me to the bottom or back to the top
    Given I am signed in as an admin on a long page
    When I open the utility panel at the top of the page
    Then the scroll button arrow points down
    When I scroll down the page and reopen the panel
    Then the scroll button arrow points up and clicking it returns me to the top
