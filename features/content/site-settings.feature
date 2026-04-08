Feature: Site-wide settings management
  As a site administrator
  I want to update site-wide settings from the admin panel
  So that I can change the site name, description, and other global properties without editing code

  Scenario: An admin updates the site title and the change is persisted
    Given the admin opens the Site Settings page
    When they change the site title and save
    Then the new title is stored and returned when settings are read back

  Scenario: Site settings are preserved across restarts
    Given the admin has saved a custom site description
    When the server restarts or the admin panel is reloaded
    Then the custom description is still in effect and visible in the settings form
