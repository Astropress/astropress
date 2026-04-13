//! Config-file templates for opt-in docs-site generators.
//!
//! All three generators are lightweight, accessible, and community-owned:
//!
//! - **Starlight** (MIT, Astro team) — WCAG AA out of the box, keyboard nav,
//!   `prefers-reduced-motion`, built-in Pagefind search. Static output.
//! - **VitePress** (MIT, Vue team) — minimal, keyboard-friendly, local-first
//!   search, dark/light themes. Static output.
//! - **mdBook** (MPL-2.0, Rust project) — zero JS framework lock-in, keyboard
//!   navigation, print-friendly. Static output.
//!
//! Docusaurus is intentionally excluded — it is Meta-owned, which conflicts
//! with the project's FOSS-first stance.
//!
//! Per-generator templates are split across sibling files to stay under the
//! 300-line arch-lint warning threshold.

mod mdbook;
mod starlight;
mod vitepress;

use crate::features::{AllFeatures, DocsChoice};

/// Returns `(path, contents)` pairs for the docs generator chosen in `f`.
/// Returns an empty vec when `f.docs == DocsChoice::None`.
pub(crate) fn docs_config_stubs(f: &AllFeatures) -> Vec<(&'static str, &'static str)> {
    match f.docs {
        DocsChoice::None      => Vec::new(),
        DocsChoice::Starlight => starlight::stubs(),
        DocsChoice::VitePress => vitepress::stubs(),
        DocsChoice::MdBook    => mdbook::stubs(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn none_returns_no_stubs() {
        let f = AllFeatures::defaults();
        assert!(docs_config_stubs(&f).is_empty());
    }

    #[test]
    fn starlight_integrates_inline_not_as_subproject() {
        let f = AllFeatures { docs: DocsChoice::Starlight, ..AllFeatures::defaults() };
        let stubs = docs_config_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        // Inline files — live inside the user's existing Astro project.
        assert!(paths.contains(&"src/content/docs/index.mdx"), "{paths:?}");
        assert!(paths.contains(&"DOCS.md"), "{paths:?}");
        // Must NOT create a separate docs/ subproject.
        assert!(!paths.contains(&"docs/package.json"), "no separate docs/ package: {paths:?}");
        assert!(!paths.contains(&"docs/astro.config.mjs"), "no separate astro.config.mjs: {paths:?}");
        // DOCS.md carries bun add command and astro.config.mjs diff.
        let docs_md = stubs.iter().find(|(p, _)| *p == "DOCS.md").unwrap().1;
        assert!(docs_md.contains("bun add @astrojs/starlight"));
        assert!(docs_md.contains("astro.config.mjs"));
    }

    #[test]
    fn vitepress_config_mentions_local_search() {
        let f = AllFeatures { docs: DocsChoice::VitePress, ..AllFeatures::defaults() };
        let config = docs_config_stubs(&f)
            .into_iter()
            .find(|(p, _)| *p == "docs/.vitepress/config.mjs")
            .unwrap()
            .1;
        assert!(config.contains("'local'"), "VitePress config should opt into local search, got: {config}");
    }

    #[test]
    fn mdbook_summary_links_introduction() {
        let f = AllFeatures { docs: DocsChoice::MdBook, ..AllFeatures::defaults() };
        let summary = docs_config_stubs(&f)
            .into_iter()
            .find(|(p, _)| *p == "docs/src/SUMMARY.md")
            .unwrap()
            .1;
        assert!(summary.contains("introduction.md"), "SUMMARY.md must link introduction.md, got: {summary}");
    }
}
