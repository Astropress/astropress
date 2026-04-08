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
