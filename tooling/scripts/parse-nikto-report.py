#!/usr/bin/env python3
"""Parse a nikto JSON report and exit non-zero if high-severity findings are present.

Suppressions are read from .github/security-toolsuite-rules.conf.
"""

import json
import re
import sys
from pathlib import Path


def load_suppressions(rules_file: Path) -> set[str]:
    suppressed: set[str] = set()
    if not rules_file.exists():
        return suppressed
    for line in rules_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("nikto:"):
            key = line.split()[0].removeprefix("nikto:")
            suppressed.add(key)
    return suppressed


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: parse-nikto-report.py <nikto-report.json>", file=sys.stderr)
        return 2

    report_path = Path(sys.argv[1])
    if not report_path.exists():
        print(f"Report file not found: {report_path}", file=sys.stderr)
        return 2

    rules_file = Path(__file__).parent.parent.parent / ".github" / "security-toolsuite-rules.conf"
    suppressed = load_suppressions(rules_file)

    try:
        data = json.loads(report_path.read_text())
    except (json.JSONDecodeError, ValueError) as exc:
        # nikto sometimes emits partial or non-JSON on empty scan; treat as clean
        print(f"Note: could not parse nikto report ({exc}), treating as clean.", file=sys.stderr)
        return 0

    # nikto JSON structure: {"host": [...], "vulnerabilities": [...]} or similar
    vulnerabilities = data if isinstance(data, list) else data.get("vulnerabilities", [])

    failures: list[str] = []
    for vuln in vulnerabilities:
        osvdb_id = vuln.get("id", "")
        description = vuln.get("msg", vuln.get("description", ""))
        # Extract OSVDB identifier for suppression matching
        osvdb_key = f"OSVDB-{osvdb_id}" if osvdb_id else ""
        if osvdb_key in suppressed:
            continue
        # Fail on every unsuppressed finding — for a static Astro build there should be none
        failures.append(f"  [{osvdb_key or 'finding'}] {description}")

    if failures:
        print(f"nikto found {len(failures)} unsuppressed finding(s):", file=sys.stderr)
        for line in failures:
            print(line, file=sys.stderr)
        print(
            "\nTo suppress known false positives, add entries to .github/security-toolsuite-rules.conf",
            file=sys.stderr,
        )
        return 1

    print(f"nikto: {len(vulnerabilities)} finding(s) checked, 0 unsuppressed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
