import type { APIRoute } from "astro";
import { handleHealthRequest } from "astropress/runtime-health.js";

export const GET: APIRoute = ({ request }) => {
  return handleHealthRequest(request);
};
