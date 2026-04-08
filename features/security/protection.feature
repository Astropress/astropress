Feature: Site security and bot protection
  As a site operator
  I want automatic protection against common web attacks
  So that readers' data and admin access are kept secure without extra configuration

  Scenario: Admin pages cannot be embedded in an external site's iframe
    Given the site is running with default security settings
    When a browser loads an admin page
    Then the Content-Security-Policy header prevents the page from being framed by any external site

  Scenario: An API client that sends too many requests in a short window is throttled
    Given a client has exceeded the configured request rate limit
    When another request arrives from that client within the same window
    Then the server responds with 429 Too Many Requests without processing the request

  Scenario: A bot submitting the contact form without solving CAPTCHA is rejected
    Given the site has Cloudflare Turnstile CAPTCHA enabled on public forms
    When a submission arrives without a valid Turnstile token
    Then the submission is rejected and no data is stored

  Scenario: Admin pages use a stricter Content-Security-Policy than public pages
    Given the site is running with default security settings
    When a public page and an admin page are both loaded
    Then the admin page CSP blocks inline scripts and restricts form targets more tightly than the public page CSP
