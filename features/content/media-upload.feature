Feature: Media upload enforcement
  As a site admin
  I want uploaded files to be rejected when they exceed the configured size limit
  So that large accidental uploads do not fill disk or exhaust storage quotas

  Scenario: Upload is rejected when the file exceeds maxUploadBytes
    Given maxUploadBytes is configured to 100 bytes in registerCms
    When a 101-byte file is submitted to createRuntimeMediaAsset
    Then the result is not-ok with an error containing "too large"
    And the storage backend is never called

  Scenario: Upload is accepted when the file is within the maxUploadBytes limit
    Given maxUploadBytes is configured to 100 bytes in registerCms
    When a 50-byte file is submitted to createRuntimeMediaAsset
    Then the result is ok and the asset is stored

  Scenario: Upload uses the 10 MiB default limit when maxUploadBytes is not configured
    Given registerCms is called without a maxUploadBytes setting
    When a 1 MiB file is submitted to createRuntimeMediaAsset
    Then the result is ok (within the 10 MiB default)

  Scenario: Width and height are stored in media_assets on image upload
    Given an image file is uploaded via createRuntimeMediaAsset
    When dimension detection resolves the pixel dimensions
    Then the media_assets row has non-null width and height columns

  Scenario: Non-image uploads have null width and height in media_assets
    Given a PDF file is uploaded via createRuntimeMediaAsset
    When the upload completes
    Then the media_assets row has null width and height columns

  Scenario: thumbnail_url column exists in media_assets schema
    Given the SQLite schema has been applied
    When the media_assets table is inspected
    Then the media_assets table includes a thumbnail_url column
