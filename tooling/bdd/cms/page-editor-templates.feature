Feature: Page templates seed sensible starting layouts

  Scenario: Blank template produces no sections
    Given the templates module
    When buildTemplate is invoked with the blank key
    Then it returns an empty array

  Scenario: Landing template instantiates hero feature-grid testimonials cta-banner
    Given the templates module
    When buildTemplate is invoked with the landing key
    Then the produced sections match the landing catalog entry

  Scenario: About template includes hero image-text feature-grid cta-banner
    Given the templates module
    When buildTemplate is invoked with the about key
    Then the produced sections match the about catalog entry

  Scenario: Contact template includes hero image-text faq cta-banner
    Given the templates module
    When buildTemplate is invoked with the contact key
    Then the produced sections match the contact catalog entry

  Scenario: Every template round-trips through parseSections
    Given the templates module and the parseSections validator
    When each template is built and re-parsed
    Then validation succeeds for blank landing about and contact
