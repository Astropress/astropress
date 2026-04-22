Feature: Site security and bot protection
  As a site operator
  I want automatic protection against common web attacks
  So that readers' data and admin access are kept secure without extra configuration

  Background:
    Given the site is deployed with default security settings

  Scenario: Admin pages cannot be embedded in an external site's iframe
    When a browser loads an admin page
    Then the Content-Security-Policy header prevents the page from being framed by any external site

  Scenario: Rate limiter blocks clients exceeding the request threshold
    Given a client has exceeded the configured request rate limit
    When another request arrives from that client within the same window
    Then the server responds with 429 Too Many Requests without processing the request

  Scenario: A bot submitting the contact form without solving CAPTCHA is rejected
    Given the site has Cloudflare Turnstile CAPTCHA enabled on public forms
    When a submission arrives without a valid Turnstile token
    Then the submission is rejected and no data is stored

  Scenario: Admin pages use a stricter Content-Security-Policy than public pages
    When a public page and an admin page are both loaded
    Then the admin page CSP blocks inline scripts and restricts form targets more tightly than the public page CSP

  Scenario: Comment author email is hashed before storage
    Given a visitor submits a comment with their email address
    When the comment repository stores the submission with a site session salt
    Then the stored email field is a 64-character keyed digest
    And the raw email address is not present anywhere in the stored record

  Scenario: Admin pages do not echo unsafe URLs from query parameters
    Given an attacker crafts a URL with a javascript: or off-site reset_link parameter
    When an admin loads the reset-password or users page with that crafted URL
    Then the unsafe URL is not rendered as a clickable link
    And only same-origin admin paths in the allowed list are surfaced as links

  Scenario: Invite and password-reset POST handlers reject requests with no origin evidence
    Given a request arrives at an auth POST endpoint without any Origin or Referer header
    When the server evaluates the request origin
    Then the server rejects the request with an invalid-origin redirect
    And requests that include a valid same-origin Origin header are accepted normally
