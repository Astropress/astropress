# Bulk Imports

Astropress Nexus orchestrates WordPress imports across a fleet of Astropress
sites from a single control plane. Use this when you are migrating several sites
at once — for example, consolidating client WordPress installs onto a shared
Astropress deployment, or bulk-migrating an agency's portfolio.

For importing into a **single site**, use the CLI or REST API instead:
→ [OPERATIONS.md — Importing content](./OPERATIONS.md#importing-content)

---

## How it works

Nexus coordinates but does not run imports itself. Each import runs **on the
member site** — Nexus sends a `POST /ap-api/v1/import/wordpress` request to
that site and tracks the outcome as an async job.

```
Operator
  → POST /connectors/{cloudways|cpanel|hpanel}/discover   discover WP sites
  → POST /jobs/import/wordpress                            queue import job
  → GET  /jobs/:id                                         poll job status
  → GET  /jobs                                             list all jobs
```

The panel connectors are optional discovery tools. If you already know which
sites to import, skip ahead to [Queueing import jobs](#queueing-import-jobs).

---

## Prerequisites

**1. Nexus is running** with member sites configured in `nexus.config.json`:

```json
{
  "sites": [
    {
      "id": "marketing",
      "name": "Marketing Site",
      "baseUrl": "https://marketing.example.com",
      "token": "sk_live_abc123"
    }
  ]
}
```

Start Nexus:

```bash
cd packages/astropress-nexus
NEXUS_AUTH_TOKEN=your-org-secret bun run start
```

**2. Each member site has an `import:write` API token.** The `token` field in
`nexus.config.json` for each site must be a token with the `import:write` scope.
Create one on each member site:

```bash
astropress api-tokens create \
  --label "Nexus import automation" \
  --scopes import:write
```

Copy the token value into `nexus.config.json` for that site.

**3. The WordPress export file is on the member site's filesystem.** The import
endpoint reads the file from the server's disk — it is not uploaded through
Nexus. Transfer the export file before queueing the job:

```bash
# Example: SFTP transfer to a remote member site
scp wordpress-export.xml user@marketing.example.com:/var/www/marketing/wp-export.xml
```

---

## Discovering sites

If your WordPress sites are managed through Cloudways, cPanel/Softaculous, or
Hostinger hPanel, the connector endpoints can enumerate them automatically.

### Cloudways

Cloudways exposes a REST API. Supply your account email and API key (found in
Cloudways Platform → Account → API):

```bash
curl -X POST https://nexus.example.com/connectors/cloudways/discover \
  -H "Authorization: Bearer $NEXUS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "email": "ops@yourorg.com", "apiKey": "cw_api_key_here" }'
```

Response:

```json
{
  "sites": [
    {
      "siteUrl": "https://blog.yoursite.com",
      "name": "Blog",
      "metadata": { "appId": "123", "appType": "wordpress" }
    },
    {
      "siteUrl": "https://shop.yoursite.com",
      "name": "Shop",
      "metadata": { "appId": "456", "appType": "woocommerce" }
    }
  ]
}
```

Cloudways does not expose WordPress admin credentials. Both `wordpress` and
`woocommerce` app types are included. Other app types (Node.js, PHP generic)
are filtered out.

### cPanel / Softaculous

Supply your cPanel hostname and login credentials. Softaculous lists all
installed apps:

```bash
curl -X POST https://nexus.example.com/connectors/cpanel/discover \
  -H "Authorization: Bearer $NEXUS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "cpanel.yourhost.com",
    "username": "cpanel_user",
    "password": "cpanel_pass"
  }'
```

Response:

```json
{
  "sites": [
    {
      "siteUrl": "https://blog.yoursite.com",
      "name": "https://blog.yoursite.com",
      "metadata": { "adminUsername": "wpadmin" }
    }
  ]
}
```

`adminUsername` is included in `metadata` for reference. The WordPress admin
password is **never forwarded through Nexus** — only the username.

### Hostinger hPanel

Supply your Hostinger OAuth access token (obtained from the Hostinger API portal
or your OAuth client credentials flow):

```bash
curl -X POST https://nexus.example.com/connectors/hpanel/discover \
  -H "Authorization: Bearer $NEXUS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "accessToken": "hpanel_oauth_token_here" }'
```

Response:

```json
{
  "sites": [
    { "siteUrl": "https://myblog.example.com", "name": "myblog.example.com", "metadata": { "plan": "premium" } },
    { "siteUrl": "https://myshop.example.com", "name": "myshop.example.com", "metadata": { "plan": "business" } }
  ]
}
```

hPanel does not expose WordPress admin credentials — only domain names and plan
metadata are returned.

---

## Queueing import jobs

Once the export file is on the member site's filesystem, queue an import job:

```bash
curl -X POST https://nexus.example.com/jobs/import/wordpress \
  -H "Authorization: Bearer $NEXUS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "marketing",
    "exportFile": "/var/www/marketing/wp-export.xml"
  }'
```

Response (202 Accepted):

```json
{ "jobId": "a3f1c2e4-7b8d-4f2a-9e1c-3d0f5a6b2c8e", "status": "queued" }
```

`exportFile` is a path on the **member site's server**, not your local machine.
The import runs asynchronously — Nexus calls the site's
`POST /ap-api/v1/import/wordpress` endpoint in the background and updates the
job record as the import progresses.

---

## Monitoring job status

Poll a single job:

```bash
curl https://nexus.example.com/jobs/a3f1c2e4-7b8d-4f2a-9e1c-3d0f5a6b2c8e \
  -H "Authorization: Bearer $NEXUS_TOKEN"
```

Response:

```json
{
  "id": "a3f1c2e4-7b8d-4f2a-9e1c-3d0f5a6b2c8e",
  "siteId": "marketing",
  "kind": "import:wordpress",
  "status": "completed",
  "queuedAt": "2026-04-13T12:00:00.000Z",
  "startedAt": "2026-04-13T12:00:01.000Z",
  "completedAt": "2026-04-13T12:04:22.000Z",
  "result": {
    "status": "completed",
    "importedRecords": 142,
    "importedMedia": 38,
    "importedRedirects": 12,
    "importedComments": 0,
    "importedUsers": 3,
    "failedMedia": [],
    "reviewRequired": false,
    "warnings": []
  }
}
```

List all jobs (newest first):

```bash
curl "https://nexus.example.com/jobs?limit=20&offset=0" \
  -H "Authorization: Bearer $NEXUS_TOKEN"
```

Response:

```json
{
  "jobs": [ ... ],
  "total": 7
}
```

### Job lifecycle

```
queued → running → completed
                 ↘ failed
```

| Status | Meaning |
|--------|---------|
| `queued` | Accepted; import request not yet sent to the member site |
| `running` | Request sent; waiting for the member site to respond |
| `completed` | Import finished; `result` contains the full `AstropressWordPressImportReport` |
| `failed` | Member site returned an error; `error` field contains the message |

**Jobs are stored in memory.** They do not survive a Nexus restart. Poll before
the process exits, or persist the `result` from `GET /jobs/:id` yourself.

---

## Bulk import script

```bash
#!/usr/bin/env bash
# bulk-import.sh — queue imports for all configured sites and poll until done
set -euo pipefail

NEXUS="https://nexus.example.com"
TOKEN="${NEXUS_TOKEN:?NEXUS_TOKEN not set}"

# Map siteId → absolute export file path on each member server
declare -A EXPORTS=(
  ["marketing"]="/var/www/marketing/wp-export.xml"
  ["docs"]="/var/www/docs/wp-export.xml"
  ["blog"]="/var/www/blog/wp-export.xml"
)

job_ids=()

echo "=== Queueing imports ==="
for site_id in "${!EXPORTS[@]}"; do
  export_file="${EXPORTS[$site_id]}"
  job_id=$(curl -sf -X POST "$NEXUS/jobs/import/wordpress" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"siteId\":\"$site_id\",\"exportFile\":\"$export_file\"}" \
    | jq -r '.jobId')
  echo "  $site_id → $job_id"
  job_ids+=("$job_id")
done

echo ""
echo "=== Polling status ==="
while true; do
  all_done=true
  for job_id in "${job_ids[@]}"; do
    result=$(curl -sf "$NEXUS/jobs/$job_id" -H "Authorization: Bearer $TOKEN")
    status=$(echo "$result" | jq -r '.status')
    site=$(echo "$result" | jq -r '.siteId')
    echo "  $site ($job_id): $status"
    if [[ "$status" == "queued" || "$status" == "running" ]]; then
      all_done=false
    fi
  done
  $all_done && break
  echo "  --- waiting 10s ---"
  sleep 10
done

echo ""
echo "All imports done. Check each job for reviewRequired or failedMedia."
```

---

## Troubleshooting

**Job fails with `403 Forbidden`**
→ The site token in `nexus.config.json` lacks `import:write` scope. Re-create
  the token with `--scopes import:write` on the member site and update the
  config.

**Job fails with `422 exportFile is required`**
→ The `exportFile` field is empty or missing from the job request body.

**Job fails with `no such file` or `ENOENT`**
→ The export file does not exist at the specified path on the member site's
  server. Transfer the file first, then re-queue.

**Job stuck in `queued` or `running` after Nexus restart**
→ In-memory job state is lost on restart. Re-queue the import — the
  `--apply-local` logic is idempotent so re-running is safe.

**Connector returns `{ "sites": [] }`**
→ Verify credentials. Cloudways filters to `wordpress`/`woocommerce` app types
  only. Check that your hosting account actually has WordPress installs.

**hPanel connector returns 502**
→ The OAuth access token may be expired. Refresh it and retry.

**`reviewRequired: true` in the import result**
→ The imported content contains shortcodes or page-builder markup Astropress
  cannot auto-convert. Log into each affected member site's admin panel and
  review `remediation-candidates.json` in the import artifacts directory.

---

## Related

- [OPERATIONS.md — Importing content](./OPERATIONS.md#importing-content) — single-site CLI and API import
- [Nexus SPEC](../../packages/astropress-nexus/SPEC.md) — full Nexus endpoint reference
