import { handleHealthRequest } from "astropress/runtime-health.js";

export const GET = ({ request }) => {
  return handleHealthRequest(request);
};
