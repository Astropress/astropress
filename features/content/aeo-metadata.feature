Feature: AEO metadata auto-wiring in content layout
  As a content publisher
  I want to add structured data metadata to my content records
  So that AI answer engines automatically index my pages without manual component wiring

  Background:
    Given AstropressContentLayout is used to render a content record

  Scenario: Content with faqItems metadata auto-renders FAQPage JSON-LD without manual component wiring
    Given a content record has metadata.faqItems with two Q&A pairs
    When the content is rendered with AstropressContentLayout
    Then the output includes a FAQPage JSON-LD script tag
    And each question and answer pair appears in the JSON-LD

  Scenario: Content with howToSteps metadata auto-renders HowTo JSON-LD
    Given a content record has metadata.howToSteps with three steps
    When the content is rendered with AstropressContentLayout
    Then the output includes a HowTo JSON-LD script tag
    And all three steps appear in the JSON-LD

  Scenario: Content with speakableCssSelectors auto-renders SpeakableSpecification JSON-LD
    Given a content record has metadata.speakableCssSelectors: ["h1", ".summary"]
    And a canonicalUrl is provided
    When the content is rendered with AstropressContentLayout
    Then the output includes a WebPage+SpeakableSpecification JSON-LD script tag

  Scenario: Content without AEO metadata renders no JSON-LD overhead
    Given a content record has no faqItems, howToSteps, or speakableCssSelectors
    When the content is rendered with AstropressContentLayout
    Then no FAQPage, HowTo, or Speakable JSON-LD is rendered
