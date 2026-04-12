Feature: Multilingual content and locale switching
  As a reader
  I want to read the site in my preferred language
  So that content is accessible to a broader audience

  Scenario: A reader can switch to the translated version of a page
    Given a post exists with both an English and a Spanish version
    When a reader on the English version selects Spanish
    Then they are taken to the corresponding Spanish page at the correct locale URL

  Scenario: Search engines can discover all language versions through hreflang tags
    Given a post has been translated into multiple languages
    When the English version is rendered
    Then the page includes hreflang alternate link tags pointing to each translated version

  Scenario: An editor can see which translated pages are current and which are out of date
    Given the admin translations panel is open
    When the editor views the translation status list
    Then each entry shows whether its translation is current, outdated, or not yet started

  Scenario: An editor creates content in two locales and both appear with correct hreflang links
    Given the CMS is configured with locales "en" and "es"
    And an editor creates a post at "/en/about-us/" with title "About Us"
    And an editor creates a post at "/es/sobre-nosotros/" with title "Sobre Nosotros"
    When the English post "/en/about-us/" is rendered
    Then the page includes a hreflang tag pointing to "/es/sobre-nosotros/" for locale "es"
    And the page includes a hreflang tag pointing to "/en/about-us/" for locale "en"
    And the localeFromPath function returns "en" for "/en/about-us/"
    And the localeFromPath function returns "es" for "/es/sobre-nosotros/"

  Scenario: Accept-Language header negotiation selects the best configured locale
    Given the CMS is configured with locales "en" and "es"
    When a request arrives with Accept-Language header "es;q=0.9, en;q=0.5"
    Then the localeFromAcceptLanguage function returns "es"
    When a request arrives with Accept-Language header "fr, de;q=0.9, en;q=0.5"
    Then the localeFromAcceptLanguage function returns "en"
    When a request arrives with no Accept-Language header
    Then the localeFromAcceptLanguage function returns the first configured locale "en"
