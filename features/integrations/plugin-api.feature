Feature: Plugin and Extension API
  As a framework consumer
  I want to extend Astropress with custom lifecycle hooks and navigation
  So that I can integrate search indexing, cache invalidation, and custom admin tools

  Scenario: A plugin's onContentSave hook is called after content is saved
    Given a plugin with an onContentSave hook is registered in CmsConfig
    When content is saved via the admin panel
    Then the plugin's onContentSave hook is called with the slug, status, and actor

  Scenario: A plugin's onContentPublish hook is called when content is published
    Given a plugin with an onContentPublish hook is registered in CmsConfig
    When content status changes to "published" via the admin panel
    Then the plugin's onContentPublish hook is called in addition to onContentSave

  Scenario: A failing plugin hook does not fail the admin action
    Given a plugin whose onContentSave throws an error
    When content is saved via the admin panel
    Then the save action succeeds and the error is caught and logged

  Scenario: A plugin can register custom admin navigation items
    Given a plugin with navItems is registered in CmsConfig
    Then getCmsConfig().plugins[0].navItems is accessible with the correct label and href

  Scenario: A plugin's onMediaUpload hook is called after a media asset is uploaded
    Given a plugin with an onMediaUpload hook is registered in CmsConfig
    When a media asset is uploaded via createRuntimeMediaAsset
    Then the plugin's onMediaUpload hook is called with the asset id, filename, mimeType, size, and actor

  Scenario: A failing onMediaUpload hook does not fail the upload action
    Given a plugin whose onMediaUpload throws an error
    When a media asset is uploaded via createRuntimeMediaAsset
    Then the upload action succeeds and the error is caught and logged
