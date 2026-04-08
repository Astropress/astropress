Feature: Playwright-based page crawl for JS-rendered sites
  As a developer importing content from a JS-heavy site (e.g. Wix)
  I want to crawl pages using a real browser
  So that dynamically rendered content is captured correctly

  Scenario: Default --crawl-pages uses fast fetch mode
    Given I run import with --crawl-pages
    Then the page crawler uses HTTP fetch without a browser

  Scenario: --crawl-pages=playwright uses full browser crawl
    Given I run import with --crawl-pages=playwright
    Then Playwright is launched
    And each page is visited with waitForLoadState("networkidle")
    And the resulting HTML includes JS-rendered content

  Scenario: Playwright crawl handles navigation errors gracefully
    Given I run import with --crawl-pages=playwright
    And one URL in the sitemap returns a 404
    Then that URL is skipped with a warning
    And the rest of the crawl continues

  Scenario: crawlSitePagesWithBrowser is exported from page-crawler module
    Then the TypeScript export crawlSitePagesWithBrowser exists in src/import/page-crawler.ts
    And it accepts siteUrl and optional timeoutMs
    And it returns an array of CrawledPage objects
