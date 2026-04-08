Feature: WordPress live-site fetch and import

  Background:
    Given an Astropress project exists

  Scenario: Operator provides URL and is prompted for credentials
    Given a reachable WordPress site at a known URL
    And no credentials file is provided
    When the operator runs "astropress import wordpress --url https://mysite.com"
    Then the CLI prompts for WordPress admin username and password
    And proceeds to log in using the provided credentials

  Scenario: Operator provides a credentials file to skip the prompt
    Given a credentials file exists at ".credentials.json" with WordPress login details
    When the operator runs "astropress import wordpress --url https://mysite.com --credentials-file .credentials.json"
    Then the CLI reads credentials from the file without prompting
    And proceeds to log in

  Scenario: Successful export download via headless browser
    Given valid WordPress admin credentials for a reachable site
    When the operator runs "astropress import wordpress --url https://mysite.com"
    Then the CLI logs into ap-admin using the credentials
    And navigates to Tools → Export
    And downloads the full WXR export file
    And reports "Export downloaded successfully"
    And continues with the normal import pipeline

  Scenario: Also crawl site pages not included in the XML export
    Given valid WordPress admin credentials
    When the operator runs "astropress import wordpress --url https://mysite.com --crawl-pages"
    Then the CLI downloads the XML export for posts and comments
    And crawls published pages via HTTP to capture page HTML content
    And merges both into the import artifact bundle

  Scenario: Unreachable site reports DNS or connection failure verbosely
    Given no site is reachable at the provided URL
    When the operator runs "astropress import wordpress --url https://notasite.example.invalid"
    Then the CLI reports "Cannot reach site: DNS lookup failed for notasite.example.invalid"
    And exits with a non-zero code without prompting for credentials

  Scenario: URL is reachable but not a WordPress site
    Given a non-WordPress site is running at the provided URL
    When the operator runs "astropress import wordpress --url https://notwordpress.example.com"
    Then the CLI reports "The URL does not appear to be a WordPress site — wp-login.php was not found"
    And exits with a non-zero code

  Scenario: Wrong credentials produce a clear login failure message
    Given a reachable WordPress site
    And the operator provides an incorrect password
    When the CLI attempts to log in
    Then the CLI reports "Login failed: username or password was incorrect"
    And exits with a non-zero code

  Scenario: Two-factor authentication blocks automated login
    Given a WordPress site that requires two-factor authentication
    When the CLI attempts to log in with valid credentials
    Then the CLI reports "Two-factor authentication is required — export the file manually and use --source"
    And exits with a non-zero code

  Scenario: CAPTCHA on login page prevents automated login
    Given a WordPress login page protected by CAPTCHA
    When the CLI attempts to log in
    Then the CLI reports "CAPTCHA detected on login page — try again later or use --source with a manually exported file"
    And exits with a non-zero code

  Scenario: Authenticated user lacks export permissions
    Given a WordPress user with Editor role but not Administrator
    When the CLI logs in and navigates to the export page
    Then the CLI reports "Insufficient permissions — the account needs Administrator access to export content"
    And exits with a non-zero code

  Scenario: Interrupted media download resumes without re-fetching completed files
    Given a staged WordPress import from a live site with partially downloaded media
    When the operator reruns with "--resume"
    Then completed media files are skipped
    And only incomplete or failed downloads are retried
