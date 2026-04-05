import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter.js";

export function createAstropressRunwayAdapter(options = {}) {
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "runway"
  });
}
