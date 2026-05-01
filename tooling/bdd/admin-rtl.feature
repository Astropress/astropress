Feature: Admin panel supports RTL locales

  Scenario: AdminLocale union includes ar
    Given the admin-locale module
    When the supported locale list is enumerated
    Then ar is registered as a supported locale

  Scenario: localeDirection returns rtl for ar
    Given the admin-locale module
    When localeDirection is invoked with the ar locale
    Then it returns rtl

  Scenario: Admin layout emits dir attribute on the html element
    Given the admin layout for an RTL locale
    When the page renders
    Then the root html element has dir set to rtl

  Scenario: Admin CSS uses logical properties for inline-axis spacing
    Given the admin stylesheet
    When inline-axis spacing is declared
    Then logical properties are used so RTL inherits the correct flow
