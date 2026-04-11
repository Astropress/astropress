Feature: FAQ structured data for AEO
  As a site owner
  I want to emit FAQPage JSON-LD on pages with question-and-answer content
  So that AI answer engines can cite my site when answering related queries

  Scenario: AstropressFaqJsonLd emits valid FAQPage JSON-LD for a list of Q&A pairs
    Given a page includes <AstropressFaqJsonLd> with two questions
    When the component renders
    Then the rendered HTML contains a script[type="application/ld+json"] block
    And the JSON-LD has @type "FAQPage"
    And each question is a mainEntity entry with @type "Question" and an acceptedAnswer

  Scenario: AstropressFaqJsonLd renders nothing when items array is empty
    Given a page includes <AstropressFaqJsonLd items={[]}>
    When the component renders
    Then the rendered FAQPage mainEntity is an empty array

  Scenario: llms.txt endpoint lists published posts for AI crawlers
    Given the public site integration is active
    When a GET request is made to /llms.txt
    Then the response lists published post titles and URLs in plain text format

  Scenario: AstropressBreadcrumbJsonLd emits valid BreadcrumbList JSON-LD
    Given a page includes <AstropressBreadcrumbJsonLd> with three breadcrumb items
    When the component renders
    Then the rendered HTML contains a script[type="application/ld+json"] block
    And the JSON-LD has @type "BreadcrumbList"
    And each item is a ListItem with position, name, and item URL

  Scenario: AstropressHowToJsonLd emits valid HowTo JSON-LD for a step-by-step guide
    Given a page includes <AstropressHowToJsonLd> with a name, description, and three steps
    When the component renders
    Then the rendered HTML contains a script[type="application/ld+json"] block
    And the JSON-LD has @type "HowTo"
    And the step array has three HowToStep entries with position, name, and text

  Scenario: AstropressSpeakableJsonLd emits WebPage + SpeakableSpecification JSON-LD with CSS selectors
    Given a page includes <AstropressSpeakableJsonLd> with url and cssSelectors=["h1", ".summary"]
    When the component renders
    Then the rendered HTML contains a script[type="application/ld+json"] block
    And the JSON-LD has @type "WebPage"
    And the speakable entry has @type "SpeakableSpecification" with cssSelector ["h1", ".summary"]

  Scenario: AstropressSpeakableJsonLd emits XPath selectors as fallback
    Given a page includes <AstropressSpeakableJsonLd> with xpaths=["/html/body/h1"]
    When the component renders
    Then the JSON-LD speakable entry contains the xpath array

  Scenario: AstropressSeoHead falls back to generated OG image when ogImage is not set
    Given a content record has no ogImage field set
    And the record has a slug and siteOrigin is provided
    When AstropressSeoHead renders
    Then the og:image meta tag points to /ap-api/v1/og-image/{slug}.png

  Scenario: Sitemap integration exports all published content URLs
    Given createAstropressSitemapIntegration is used as an Astro integration
    When the integration's astro:config:setup hook is invoked
    Then it injects the /sitemap.xml route
    And it injects the og-image endpoint
