import { handleHealthRequest } from "@astropress-diy/astropress/runtime-health.js";

export const GET = ({ request }) => {
	return handleHealthRequest(request);
};
