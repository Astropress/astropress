Feature: Admin command palette for quick navigation

  Scenario: Pressing Ctrl+K opens the command palette
    Given I am logged in as an admin
    When I press Ctrl+K on any admin page
    Then the command palette dialog opens and the search input is focused

  Scenario: Typing in the palette filters nav items
    Given the command palette is open
    When I type "post" in the search input
    Then only nav items whose labels contain "post" are shown

  Scenario: Pressing Enter on a selected result navigates to that page
    Given the command palette is open with results visible
    When I press ArrowDown then Enter
    Then the browser navigates to the href of the selected result

  Scenario: Pressing Escape closes the palette
    Given the command palette is open
    When I press Escape
    Then the command palette dialog is closed
