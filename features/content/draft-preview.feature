Feature: Draft preview on the admin domain

  Background:
    Given an Astropress admin panel is running

  Scenario: Admin previews a draft post before it is published
    Given the user is logged in as an admin
    And there is a draft post with slug "coming-soon"
    When the admin navigates to /ap-admin/preview/coming-soon
    Then the draft content is rendered
    And a status chip shows "draft"

  Scenario: Draft post is not accessible on the production domain
    Given a draft post with slug "coming-soon" exists in the database
    When the static production build runs with createAstropressPublicSiteIntegration
    Then no route for /blog/coming-soon is injected into the static build

  Scenario: Unauthenticated visitor cannot access preview URLs on the admin domain
    Given the user is not logged in
    When the user navigates to /ap-admin/preview/some-post
    Then the user is redirected to /ap-admin/login
