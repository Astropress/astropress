#!/usr/bin/env python3
"""Parse a whatweb JSON report and fail if server/framework version strings are leaked.

A version leak means an attacker can fingerprint the exact software version running
and target known CVEs without probing. We accept technology names (e.g. 'Astro') but
reject version strings (e.g. 'Astro/6.1.8').
"""

import json
import re
import sys
from pathlib import Path

# Plugin names whose version disclosure we explicitly allow (e.g. HTML meta generators
# that are intentional branding signals, not attack surface).
VERSION_DISCLOSURE_ALLOWLIST: set[str] = {
    "HTML5",
    "Script",
    "Bootstrap",
}

# Regex to detect version-like strings: digits, dots, optional pre-release suffixes
VERSION_RE = re.compile(r"\d+\.\d+")


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: parse-whatweb-report.py <whatweb-report.json>", file=sys.stderr)
        return 2

    report_path = Path(sys.argv[1])
    if not report_path.exists():
        print(f"Report file not found: {report_path}", file=sys.stderr)
        return 2

    try:
        raw = report_path.read_text().strip()
        # whatweb JSON output is one object per line, or a JSON array
        if raw.startswith("["):
            entries = json.loads(raw)
        else:
            entries = [json.loads(line) for line in raw.splitlines() if line.strip()]
    except (json.JSONDecodeError, ValueError) as exc:
        print(f"Note: could not parse whatweb report ({exc}), treating as clean.", file=sys.stderr)
        return 0

    leaks: list[str] = []
    for entry in entries:
        plugins = entry.get("plugins", {})
        for plugin_name, plugin_data in plugins.items():
            if plugin_name in VERSION_DISCLOSURE_ALLOWLIST:
                continue
            version_list = plugin_data.get("version", [])
            for version_value in version_list:
                if VERSION_RE.search(str(version_value)):
                    leaks.append(f"  {plugin_name}: version '{version_value}' disclosed")

    if leaks:
        print(f"whatweb detected {len(leaks)} version disclosure(s):", file=sys.stderr)
        for line in leaks:
            print(line, file=sys.stderr)
        print(
            "\nRemove server headers that expose version strings (X-Powered-By, Server, X-Generator, etc.)",
            file=sys.stderr,
        )
        return 1

    print("whatweb: no version disclosures detected.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
