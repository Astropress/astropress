Feature: Fleet Farming consumes the extracted package
  Scenario: Fleet uses a local Astropress package artifact
    Given the extracted Astropress repo exists at /home/user/code/astropress
    When Fleet installs the local Astropress package
    Then Fleet resolves Astropress from the external repo rather than the in-repo workspace copy
