Feature: astropress add --docs — scaffold a lightweight, accessible docs-site
  As a developer
  I want to add a docs-site generator to an existing Astropress project
  So that I can publish reference documentation without pulling in big-tech-owned tools

  Scenario: astropress add --docs starlight scaffolds an Astro + Starlight docs site
    Given an existing Astropress project directory
    When I run "astropress add --docs starlight"
    Then docs/package.json references @astrojs/starlight
    And docs/astro.config.mjs is written to the project
    And docs/src/content/docs/index.mdx is written to the project

  Scenario: astropress add --docs vitepress scaffolds a VitePress docs site
    Given an existing Astropress project directory
    When I run "astropress add --docs vitepress"
    Then docs/package.json references vitepress
    And docs/.vitepress/config.mjs is written to the project
    And docs/index.md is written to the project

  Scenario: astropress add --docs mdbook scaffolds an mdBook docs site
    Given an existing Astropress project directory
    When I run "astropress add --docs mdbook"
    Then docs/book.toml is written to the project
    And docs/src/SUMMARY.md is written to the project
    And docs/src/introduction.md is written to the project

  Scenario: astropress add --docs with an unknown generator returns a clear error
    Given an existing Astropress project directory
    When I run "astropress add --docs bigtech"
    Then the command exits with a non-zero status
    And the error message lists starlight, vitepress, and mdbook
