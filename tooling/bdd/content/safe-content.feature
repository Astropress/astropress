Feature: Safe content display for readers and editors
  As a reader
  I want to be protected from malicious code embedded in blog content
  So that visiting the site does not put my browser or personal data at risk

  Scenario: A reader viewing an imported post is not exposed to injected scripts
    Given a post was imported with script tags or event handler attributes in its body
    When the post is rendered for a reader
    Then all scripts and event handlers are stripped and only the text content is displayed

  Scenario: Imported posts are sanitized to remove XSS vulnerabilities
    Given an editor pastes HTML containing an `<img onclick="alert('xss')">` and an `<a href="javascript:void(0)">Click me</a>`
    When the content is saved and a reader views the post
    Then the onclick attribute is stripped from the img element
    And the javascript: href is removed, leaving only the link text "Click me"

  Scenario: Off-screen images on a long post load lazily so the page appears quickly
    Given a post contains multiple images below the visible fold
    When the page is loaded in a browser
    Then only images near the top of the page load immediately and the rest are deferred
