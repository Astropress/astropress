# Astropress telemetry

Astropress can optionally share anonymous usage data to help prioritise development work.
Telemetry is **opt-in** — you must explicitly choose `y` at the prompt or run
`astropress telemetry enable`. Nothing is sent until you do.

---

## What is collected

### `astropress new` — project created

Sent once, at the end of `astropress new`, when you opt in.

```jsonc
{
  "event":         "project_created",
  "version":       "0.4.1",              // CLI semver, identifies adoption of new releases
  "os":            "linux",              // std::env::consts::OS: linux | macos | windows | freebsd | other
  "app_host":      "cloudflare-pages",   // chosen hosting target (see AppHost enum), or "none"
  "data_services": "cloudflare",         // chosen cloud data services (see DataServices enum), or "none"
  "features": {
    // Each value is the Debug variant name of the enum choice.
    // "None" means that integration was not selected.
    "cms":                 "BuiltIn",
    "analytics":           "Umami",
    "payments":            "HyperSwitch",
    "social":              "None",
    "commerce":            "None",
    "email":               "Listmonk",
    "transactional_email": "Resend",
    "forum":               "None",
    "chat":                "None",
    "notify":              "None",
    "schedule":            "None",
    "video":               "None",
    "podcast":             "None",
    "events":              "None",
    "sso":                 "None",
    "crm":                 "None",
    "knowledge_base":      "None",
    "search":              "Pagefind",
    "courses":             "None",
    "forms":               "None",
    "status":              "None",
    "ab_testing":          "None",
    "heatmap":             "None",
    "docs":                "None",
    "job_board":           false,   // boolean
    "enable_api":          false    // boolean
  }
}
```

### Import feedback — after a WordPress or Wix import

Sent only when you choose "No — something was wrong" after an import **and** consent to share.
This is a separate prompt; it does not inherit the `astropress new` consent decision.

```jsonc
{
  "source":        "wordpress",              // or "wix"
  "issues":        ["Missing images or media"],  // up to 5 items you selected
  "post_count":    142,                      // number of posts in the import
  "warning_count": 3,                        // number of warnings emitted
  "platform":      "linux"                   // same values as "os" above
}
```

---

## What is NOT collected

| Category | Detail |
|----------|--------|
| IP addresses | Discarded in the receiver before any write — never stored |
| Precise timestamps | Truncated to the Monday of the ISO week before insert |
| Paths or filenames | No project directory, no file paths |
| Site content | No post titles, page content, or media |
| Credentials | No API tokens, passwords, or secrets |
| Free-text input | All string fields are enum variant names or predefined labels |
| Cross-event linkage | No session ID or device ID — events cannot be joined to the same user |

The receiver rejects any payload with unknown fields (HTTP 400), which prevents accidental PII
from reaching storage if a future CLI bug adds an unexpected key.

---

## Where the data goes

Events are sent to `https://telemetry.astropress.diy` — a Cloudflare Worker that writes to a
D1 (SQLite) database. No third-party analytics service (Segment, Amplitude, Mixpanel, etc.)
receives the data. The receiver source is open and linked from the
[astropress-diy repository](https://github.com/Astropress/astropress-diy).

Raw rows are automatically deleted after **90 days**. Weekly aggregate counts (install totals,
integration adoption rates, OS distribution) are kept indefinitely and published on
[astropress.diy](https://astropress.diy).

---

## Controlling telemetry

### CLI subcommand

```sh
astropress telemetry status    # show current setting
astropress telemetry enable    # opt in
astropress telemetry disable   # opt out
```

Preference is stored in `~/.astropress/config.json`.

### Environment variables

Any of the following permanently suppress telemetry regardless of the stored preference.
No prompt is shown; no data is sent.

| Variable | Value that suppresses |
|----------|-----------------------|
| `ASTROPRESS_TELEMETRY` | `0`, `false`, or `disabled` |
| `DO_NOT_TRACK` | `1` (EFF DNT spec) |
| `CI` | any value |
| `GITHUB_ACTIONS` | any value |
| `GITLAB_CI` | any value |
| `CIRCLECI` | any value |

CI environments are always suppressed — no prompt is shown in automated pipelines.

---

## Receiver endpoint reference

The CLI sends to these hardcoded URLs (see `crates/astropress-cli/src/telemetry.rs`):

| Event | Endpoint |
|-------|----------|
| Project created | `POST https://telemetry.astropress.diy/project-created` |
| Import feedback | `POST https://telemetry.astropress.diy/import-feedback` |

Both endpoints return `202 Accepted` on success. The CLI fires and forgets — it does not
wait for or inspect the response.

### Validation the receiver enforces

- Total body size ≤ 4 KB — rejected with 400
- `event` must equal `"project_created"` exactly — rejected with 400
- `version` must match `/^\d+\.\d+\.\d+/` and be ≤ 20 chars — rejected with 400
- `os` / `platform` values not in the known list are coerced to `"other"`
- `app_host` must be one of the known AppHost slug values or `"none"` — unknown values coerced to `"other"`
- `data_services` must be one of the known DataServices slug values or `"none"` — unknown values coerced to `"other"`
- Each `features.*` string must be ≤ 64 chars and match `[A-Za-z0-9_]` — rejected with 400
- Unknown top-level keys — rejected with 400

---

## Questions or concerns

Open an issue at [github.com/Astropress/astropress/issues](https://github.com/Astropress/astropress/issues).
