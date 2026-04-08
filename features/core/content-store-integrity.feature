Feature: Content store integrity

  Scenario: Cloudflare content adapter persists post status updates through the database
    Given an existing post record in the Cloudflare content store
    When the operator updates the post status and title
    Then reading the record back from the database reflects the updated values

  Scenario: Cloudflare media adapter records the byte size of uploaded assets
    Given a media asset with binary content
    When the operator stores the asset in the Cloudflare media store
    Then the stored media record includes the correct file size in bytes
