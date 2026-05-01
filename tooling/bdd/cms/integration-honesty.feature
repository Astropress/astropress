Feature: Sidebar honesty — coming soon vs real integrations

  Scenario: Sidebar renders a distinct Coming soon group
    Given the operator is on the admin dashboard
    When the sidebar nav renders
    Then a single sidebar-group element carries data-coming-soon="true"

  Scenario: Coming-soon leaves are scoped to the muted group
    Given the operator is on the admin dashboard
    When the sidebar nav renders
    Then every coming-soon leaf in the integration manifest renders under data-coming-soon="true"

  Scenario: Real and env-gated leaves stay under Integrations
    Given the operator is on the admin dashboard
    When the sidebar nav renders
    Then no real or env-gated integration href appears under the muted group

  Scenario: Coming-soon pages show roadmap copy, not env-var hints
    Given the operator opens /ap-admin/heatmaps
    When the page renders
    Then a "Coming soon" eyebrow is shown, no <pre><code> env hint is rendered, and a roadmap link to GitHub issue #76 is present
