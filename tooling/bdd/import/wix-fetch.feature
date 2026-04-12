Feature: Wix live-site fetch and import

  Background:
    Given an Astropress project exists

  Scenario: Operator provides URL and is prompted for Wix credentials
    Given a reachable Wix site at a known URL
    And no credentials file is provided
    When the operator runs "astropress import wix --url https://username.wixsite.com/mysite"
    Then the CLI prompts for Wix account email and password
    And proceeds to log in via the Wix dashboard

  Scenario: Successful blog post export via headless browser
    Given valid Wix account credentials for a site with blog posts
    When the operator runs "astropress import wix --url https://username.wixsite.com/mysite"
    Then the CLI logs into Wix using the provided credentials
    And navigates to the Blog post manager
    And triggers the Export Posts download
    And reports "Wix blog export downloaded successfully"
    And continues with the CSV import pipeline

  Scenario: Crawl Wix pages not available in the blog export
    Given valid Wix credentials and a site with both blog posts and static pages
    When the operator runs "astropress import wix --url https://username.wixsite.com/mysite --crawl-pages"
    Then the CLI downloads the blog CSV for posts
    And fetches the published site's sitemap or linked pages via HTTP
    And imports page HTML as additional content records
    And reports how many pages were crawled alongside how many posts were imported

  Scenario: Wix login rejects invalid credentials
    Given a reachable Wix site
    And the operator provides an incorrect password
    When the CLI attempts to log in via the Wix dashboard
    Then the CLI reports "Login failed: incorrect email or password"
    And exits with a non-zero code

  Scenario: Wix requires phone verification (2FA)
    Given a Wix account with phone verification enabled
    When the CLI attempts to log in with valid credentials
    Then the CLI reports "Two-factor authentication is required — export the CSV manually from the Wix dashboard and use --source"
    And exits with a non-zero code

  Scenario: CAPTCHA blocks automated Wix login
    Given a Wix login page showing a CAPTCHA challenge
    When the CLI attempts to log in
    Then the CLI reports "CAPTCHA detected — try again later or export the CSV manually and use --source"
    And exits with a non-zero code

  Scenario: Published site URL does not match any Wix account blog
    Given valid Wix credentials but the URL belongs to a different account
    When the CLI logs in and attempts to find the blog export
    Then the CLI reports "No blog found for this site in the Wix account — check the URL and credentials"
    And exits with a non-zero code

  Scenario: Page crawler reports failed pages without aborting the import
    Given a Wix site where some pages return 404 or connection errors during crawl
    When the operator runs with "--crawl-pages"
    Then each failed page is logged individually with its URL and reason
    And the import continues with successfully crawled pages
    And the final report includes a failed-pages count
