import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  // Set base: "/astropress/" if deploying to a GitHub Pages subpath.
  integrations: [
    starlight({
      title: "Astropress",
      description:
        "An Astro web app framework with a built-in admin panel and optional self-hosted integrations.",
      // Accessibility: WCAG AA contrast, skip-to-content, keyboard nav,
      // and prefers-reduced-motion support ship by default.
      // https://starlight.astro.build/guides/accessibility/
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/astropress/astropress",
        },
      ],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "index" },
            { label: "Quick start", slug: "guides/quick-start" },
            { label: "Two-site deployment", slug: "guides/two-site-deploy" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Analytics", slug: "guides/analytics" },
            { label: "Multilingual sites", slug: "guides/multilingual" },
            { label: "Operations", slug: "guides/operations" },
            { label: "Compliance", slug: "guides/compliance" },
          ],
        },
        {
          label: "Integrations",
          items: [
            { label: "Content management", slug: "integrations/cms" },
            { label: "Email & newsletters", slug: "integrations/email" },
            { label: "Commerce & payments", slug: "integrations/commerce" },
            { label: "Community & discussion", slug: "integrations/community" },
            { label: "Search", slug: "integrations/search" },
            { label: "Authentication & SSO", slug: "integrations/identity" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "CLI reference", slug: "reference/cli" },
            { label: "API reference", slug: "reference/api" },
            { label: "Compatibility", slug: "reference/compatibility" },
            { label: "Browser support", slug: "reference/browser-support" },
            { label: "Design system", slug: "reference/design-system" },
            { label: "Web components", slug: "reference/web-components" },
          ],
        },
        {
          label: "Contributing",
          collapsed: true,
          items: [
            { label: "Publishing to npm", slug: "contributing/publishing" },
            { label: "Quality evaluation", slug: "contributing/evaluation" },
          ],
        },
      ],
    }),
  ],
});
