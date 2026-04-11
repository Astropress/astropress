Feature: Admin UI internationalisation
  As a site operator
  I want the admin panel to display labels in the site's configured locale
  So that non-English-speaking administrators can work in their own language

  Background:
    Given the site is configured with a primary locale

  Scenario: Admin UI displays labels in the site's configured locale
    Given the site's first locale is "es"
    When the admin panel renders shared labels
    Then the save button shows "Guardar"
    And the sign-out button shows "Cerrar sesión"
    And the sidebar heading shows "Espacio de trabajo"

  Scenario: Admin UI falls back to English for an unknown locale
    Given the site's first locale is "zz"
    When the admin panel renders shared labels
    Then the save button shows "Save"
    And the sign-out button shows "Sign out"

  Scenario: Admin UI falls back to English for an unknown label key
    Given the site's first locale is "fr"
    When an unknown label key is requested
    Then the label key itself is returned as the fallback value

  Scenario: BCP-47 locale tags with region code resolve to the base locale
    Given the site's first locale is "es-MX"
    When the admin panel renders shared labels
    Then the save button shows "Guardar"
