Feature: Published content appears in static build

  Background:
    Given a platform adapter with published and draft content

  Scenario: Published blog post is returned by the build-time loader
    Given the provider has a published post with slug "hello-world"
    When ContentStore.list is called with status "published"
    Then the result includes the "hello-world" post
    And the result does not include any draft posts

  Scenario: Draft post is excluded when filtering by published status
    Given the provider has a draft post with slug "unpublished"
    When ContentStore.list is called with status "published"
    Then the result does not include the "unpublished" post

  Scenario: All posts are returned when no status filter is given
    Given the provider has both a published and a draft post
    When ContentStore.list is called with no status filter
    Then the result includes all posts regardless of status

  Scenario: Content kind filter works alongside status filter
    Given the provider has a published post and a published page
    When ContentStore.list is called for kind "post" with status "published"
    Then the result includes only posts and not pages

  Scenario: ContentListOptions pagination works correctly
    Given the provider has 10 published posts
    When ContentStore.list is called with limit 3 and offset 0
    Then the result contains at most 3 records

  Scenario: Build-time loader returns content shaped as ContentStoreRecord
    Given the in-memory adapter has a published post
    When createAstropressBuildTimeLoader returns posts
    Then each record has id, kind, slug, status, and title fields
