Feature: Playwright-based page crawl for JS-rendered sites
  As a developer importing content from a JS-heavy site (e.g. Wix)
  I want to crawl pages using a real browser
  So that dynamically rendered content is captured correctly

  Scenario: Default --crawl-pages uses fast fetch mode
    Given a site is available for import
    When I run import with --crawl-pages
    Then the page crawler uses HTTP fetch without a browser

  Scenario: --crawl-pages=playwright uses full browser crawl
    Given a site is available for import
    When I run import with --crawl-pages=playwright
    Then Playwright is launched
    And each page is visited with waitForLoadState("networkidle")
    And the resulting HTML includes JS-rendered content

  Scenario: Playwright crawl handles navigation errors gracefully
    Given a site is available for import
    When I run import with --crawl-pages=playwright
    And one URL in the sitemap returns a 404
    Then that URL is skipped with a warning
    And the rest of the crawl continues

  Scenario: Developers can use the page crawler library to crawl JS-rendered sites programmatically
    Given a developer imports the AstroPress page-crawler module in their script
    When they call the browser crawler with a site URL and an optional timeout
    Then an array of crawled pages is returned, each with a URL and the rendered HTML body
    And the function is available as a named export from the module
