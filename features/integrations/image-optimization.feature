Feature: Responsive image component and Core Web Vitals
  As a site developer
  I want an image component that enforces CWV best practices automatically
  So that pages using it have low CLS and fast LCP without manual attribute wiring

  Scenario: AstropressImage renders with explicit width, height, and aspect-ratio style
    Given an AstropressImage with src="/img/hero.jpg" width=1200 height=630
    When the component is rendered
    Then the img element has width="1200" height="630"
    And the style attribute includes "aspect-ratio: 1200 / 630"

  Scenario: AstropressImage defaults to loading="lazy" and decoding="async"
    Given an AstropressImage with no loading or decoding props
    When the component is rendered
    Then the img has loading="lazy"
    And the img has decoding="async"

  Scenario: AstropressImage renders srcset and sizes for responsive images
    Given an AstropressImage with srcset and sizes props
    When the component is rendered
    Then the img has the provided srcset attribute
    And the img has the provided sizes attribute

  Scenario: AstropressImage supports fetchpriority="high" for LCP images
    Given an AstropressImage with fetchpriority="high" and loading="eager"
    When the component is rendered
    Then the img has fetchpriority="high"
    And the img has loading="eager"

  Scenario: AstropressImage merges additional inline styles with aspect-ratio
    Given an AstropressImage with style="border-radius: 8px"
    When the component is rendered
    Then the style attribute contains both "aspect-ratio" and "border-radius"
