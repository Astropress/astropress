#!/usr/bin/env bash
#
# Run the CI Nuclei scan locally against the github-pages example.
# Avoids the slow push/wait/retry loop when iterating on security-header
# changes or suppression rationale.
#
# Requires: nuclei (install via `go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest`
#           or `brew install nuclei`).
#
# Usage:
#   tooling/scripts/run-nuclei-local.sh            # Run with CI's flags
#   tooling/scripts/run-nuclei-local.sh --no-em    # Run WITHOUT suppressions
#                                                  # (useful to see what CI is hiding)

set -euo pipefail

PORT=${PORT:-4173}
REPO_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$REPO_ROOT"

if ! command -v nuclei >/dev/null 2>&1; then
  echo "nuclei not found on PATH."
  echo "  macOS:   brew install nuclei"
  echo "  Linux:   go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest"
  exit 1
fi

if [ ! -d "examples/github-pages/dist" ]; then
  echo "Building github-pages example first..."
  bun run --filter astropress-example-gh-pages build
fi

echo "Starting static server on http://127.0.0.1:$PORT..."
node tooling/scripts/serve-static-with-security-headers.mjs \
  examples/github-pages/dist "$PORT" >/tmp/astropress-nuclei-local.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

# Wait for server
for _ in {1..30}; do
  if curl -sf "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Extract the exact Nuclei args from the CI workflow so local runs match CI.
ARGS=$(awk '
  /- name: Run nuclei/ { in_step=1; next }
  in_step && /args:/ { collect=1; next }
  collect && /^ +-/ { print; next }
  collect && /^[^ ]/ { exit }
  in_step && /^ +- name:/ { exit }
' .github/workflows/security-toolsuite.yml \
  | sed 's/^[[:space:]]*//' \
  | tr '\n' ' ')

if [ "${1:-}" = "--no-em" ]; then
  # Strip the exclude-matchers suppression to see the raw findings
  ARGS=$(echo "$ARGS" | sed -E 's/-em [^ ]+ ?//g; s/-ei [^ ]+ ?//g')
  echo ""
  echo "  ** Running WITHOUT suppressions — expect false-positive noise **"
fi

echo ""
echo "nuclei $ARGS"
echo ""
# shellcheck disable=SC2086 # intentional word split for arg list
nuclei $ARGS
