# @astropress-diy/mcp

MCP server for [Astropress](https://astropress.diy) — lets AI agents read and write content via the Astropress REST API.

Connect Claude, Cursor, or any MCP-compatible AI tool directly to your Astropress site so it can list, draft, update, and inspect content without leaving the editor.

## Prerequisites

A running Astropress site with API access enabled. Any deployment target works (local SQLite, Cloudflare D1, Supabase, etc.).

## Configuration

Set two environment variables before starting the server:

| Variable | Description |
|---|---|
| `ASTROPRESS_API_URL` | Base URL of your Astropress site, e.g. `https://example.com` |
| `ASTROPRESS_API_TOKEN` | API token from the Astropress admin panel (Settings → API Tokens) |

## Usage

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "astropress": {
      "command": "npx",
      "args": ["astropress-mcp"],
      "env": {
        "ASTROPRESS_API_URL": "https://your-site.com",
        "ASTROPRESS_API_TOKEN": "your-token"
      }
    }
  }
}
```

### Cursor / other MCP clients

```bash
ASTROPRESS_API_URL=https://your-site.com \
ASTROPRESS_API_TOKEN=your-token \
npx astropress-mcp
```

### Run directly

```bash
npm install -g @astropress-diy/mcp
ASTROPRESS_API_URL=https://your-site.com ASTROPRESS_API_TOKEN=your-token astropress-mcp
```

## Tools

| Tool | Description |
|---|---|
| `list_content` | List content records, optionally filtered by type (`post`/`page`) and status (`draft`/`published`/`archived`) |
| `get_content` | Get a single content record by ID or slug |
| `create_content` | Create a new content record |
| `update_content` | Update an existing content record by ID or slug |
| `list_media` | List all media assets |
| `get_site_settings` | Get site settings (title, tagline, etc.) |
| `get_health` | Check the health of the Astropress site |
| `get_revisions` | Get the full revision history for a content record |

## License

MIT — see the [Astropress repository](https://github.com/astropress/astropress).
