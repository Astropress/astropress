import { handleHealthRequest } from "@astropress-diy/astropress/runtime-health.js";
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ request }) => {
	return handleHealthRequest(request);
};
