Feature: Admin user authentication and access control
  As a site administrator
  I want to manage who can log in to the admin panel and what they can do
  So that only authorised people can edit content or change site settings

  Scenario: An admin logs in with their password and gets access to the panel
    Given an admin account exists with a known email and password
    When the admin submits correct credentials on the login page
    Then they are granted a session and can access the admin panel

  Scenario: A session expires so that unattended logins do not remain active
    Given an admin session has passed its expiry time
    When the admin attempts to load an admin page
    Then they are redirected to the login page to re-authenticate

  Scenario: An admin can reset a forgotten password via an emailed link
    Given an admin has requested a password reset on the login page
    When they follow the unique reset link sent to their email
    Then they can choose a new password and regain access to the panel

  Scenario: An admin can invite a new editor who sets their own password on first login
    Given an admin sends an invitation email to a new editor
    When the editor opens the invite link
    Then they can set their own password and are granted editor access to the panel
