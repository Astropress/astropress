#!/usr/bin/env node
/**
 * Astropress MCP Server
 *
 * Exposes Astropress content management operations as MCP tools so that
 * AI agents can read and write content via the REST API.
 *
 * Usage: npx astropress-mcp
 *
 * Required env vars:
 *   ASTROPRESS_API_URL   — base URL of the Astropress site, e.g. http://localhost:4321
 *   ASTROPRESS_API_TOKEN — API token with appropriate scopes
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

const apiUrl = (process.env.ASTROPRESS_API_URL ?? "http://localhost:4321").replace(/\/$/, "");
const apiToken = process.env.ASTROPRESS_API_TOKEN ?? "";

function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiToken) headers["Authorization"] = `Bearer ${apiToken}`;
  return headers;
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${apiUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: { ...apiHeaders(), ...(options.headers as Record<string, string> ?? {}) },
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text, status: response.status };
  }
}

const tools: Tool[] = [
  {
    name: "list_content",
    description: "List content records. Optionally filter by type (post/page) and status (draft/published/archived).",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Content kind: post or page" },
        status: { type: "string", description: "Filter by status: draft, published, archived" },
        limit: { type: "number", description: "Max records to return (default 20, max 100)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "get_content",
    description: "Get a single content record by ID or slug.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Content ID or slug" },
      },
    },
  },
  {
    name: "create_content",
    description: "Create a new content record.",
    inputSchema: {
      type: "object",
      required: ["slug", "title"],
      properties: {
        slug: { type: "string", description: "URL slug (unique, lowercase, hyphens)" },
        title: { type: "string", description: "Content title" },
        kind: { type: "string", description: "post or page (default: post)" },
        body: { type: "string", description: "HTML body content" },
        status: { type: "string", description: "draft or published (default: draft)" },
      },
    },
  },
  {
    name: "update_content",
    description: "Update an existing content record by ID or slug.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Content ID or slug" },
        title: { type: "string" },
        body: { type: "string" },
        status: { type: "string", description: "draft, published, or archived" },
      },
    },
  },
  {
    name: "list_media",
    description: "List all media assets.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_site_settings",
    description: "Get the site settings (title, tagline, etc.).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_health",
    description: "Check the health of the Astropress site.",
    inputSchema: { type: "object", properties: {} },
  },
];

const server = new Server(
  { name: "astropress-mcp", version: "0.0.1" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const input = (args ?? {}) as Record<string, unknown>;

  try {
    let result: unknown;

    switch (name) {
      case "list_content": {
        const params = new URLSearchParams();
        if (input.type) params.set("kind", String(input.type));
        if (input.status) params.set("status", String(input.status));
        if (input.limit) params.set("limit", String(input.limit));
        if (input.offset) params.set("offset", String(input.offset));
        result = await apiFetch(`/ap-api/v1/content?${params.toString()}`);
        break;
      }
      case "get_content": {
        result = await apiFetch(`/ap-api/v1/content/${encodeURIComponent(String(input.id))}`);
        break;
      }
      case "create_content": {
        result = await apiFetch("/ap-api/v1/content", {
          method: "POST",
          body: JSON.stringify({
            slug: input.slug,
            title: input.title,
            kind: input.kind ?? "post",
            body: input.body ?? "",
            status: input.status ?? "draft",
          }),
        });
        break;
      }
      case "update_content": {
        result = await apiFetch(`/ap-api/v1/content/${encodeURIComponent(String(input.id))}`, {
          method: "PUT",
          body: JSON.stringify(input),
        });
        break;
      }
      case "list_media": {
        result = await apiFetch("/ap-api/v1/media");
        break;
      }
      case "get_site_settings": {
        result = await apiFetch("/ap-api/v1/settings");
        break;
      }
      case "get_health": {
        result = await apiFetch("/ap/health");
        break;
      }
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
