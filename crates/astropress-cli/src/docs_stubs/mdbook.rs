//! mdBook (Rust project, MPL-2.0) — zero JS framework lock-in, print-friendly.

pub(super) fn stubs() -> Vec<(&'static str, &'static str)> {
    vec![
        ("docs/book.toml",           BOOK_TOML),
        ("docs/src/SUMMARY.md",      SUMMARY),
        ("docs/src/introduction.md", INTRODUCTION),
        ("docs/README.md",           README),
    ]
}

const BOOK_TOML: &str = r#"# mdBook config — MPL-2.0, community-owned (Rust project).
# Accessibility: semantic HTML, keyboard navigation, skip links, and
# print-friendly output ship by default. No JS framework dependency.
[book]
title    = "Documentation"
authors  = []
language = "en"
src      = "src"

[output.html]
default-theme         = "light"
preferred-dark-theme  = "navy"
git-repository-url    = ""
"#;

const SUMMARY: &str = r#"# Summary

- [Introduction](./introduction.md)
"#;

const INTRODUCTION: &str = r#"# Introduction

Welcome. Replace this page with your own content.

## Why mdBook?

- **MPL-2.0**, community-maintained tool from the Rust project.
- **Zero JS framework lock-in** — outputs accessible, semantic HTML.
- **Keyboard-first navigation** and print-friendly output by default.

Edit `src/SUMMARY.md` to register more chapters and add their markdown files
under `src/`.
"#;

const README: &str = r#"# Docs site (mdBook)

Lightweight, accessible documentation site. MPL-2.0, community-owned.

## Prerequisites

Install `mdbook` via cargo (or your distro's package manager):

```sh
cargo install mdbook --locked
```

## Local development

```sh
cd docs
mdbook serve --open    # http://localhost:3000
```

## Build static output

```sh
mdbook build           # emits `book/`
```

Deploy `book/` to any static host. See https://rust-lang.github.io/mdBook/.
"#;
