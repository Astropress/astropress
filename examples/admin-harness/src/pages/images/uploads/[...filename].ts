import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { APIRoute } from "astro";

import { guessMediaMimeType } from "@astropress-diy/astropress/local-media-storage";

const configuredDataDirectory = process.env.ASTROPRESS_DATA_ROOT?.trim();
const localImageRoot = process.env.ASTROPRESS_LOCAL_IMAGE_ROOT?.trim();
const dataDirectory = localImageRoot || configuredDataDirectory || fileURLToPath(new URL("../../../../.data/", import.meta.url));
const uploadsDirectory = join(dataDirectory, "uploads");

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const filename = String(params.filename ?? "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .at(-1);

  if (!filename || filename.includes("..") || filename.includes("/")) {
    return new Response("Not found", { status: 404 });
  }

  const diskPath = join(uploadsDirectory, filename);

  try {
    const bytes = await readFile(diskPath);
    return new Response(bytes, {
      headers: {
        "content-type": guessMediaMimeType(filename),
        "cache-control": "public, max-age=60",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};
