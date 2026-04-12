Feature: Visitor contact form submissions
  As a site owner
  I want to receive and review messages from visitors who fill in the contact form
  So that I can respond to reader enquiries without sharing my email address publicly

  Scenario: A visitor submits the contact form and their message is saved for the admin to read
    Given a visitor fills in the contact form with their name, email, and message
    When they click submit
    Then the submission is saved and visible in the admin submissions panel

  Scenario: An admin can browse all contact submissions in the admin panel
    Given several visitors have submitted the contact form
    When the admin opens the submissions section
    Then all submissions are listed with the sender's details and the time they were submitted
