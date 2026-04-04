function unavailable(): never {
  throw new Error(
    "Local runtime fallbacks are unavailable in the Cloudflare build. Configure the required Cloudflare bindings instead.",
  );
}

export async function loadLocalAdminStore() {
  unavailable();
}

export async function loadLocalAdminAuth() {
  unavailable();
}

export async function loadLocalImageStorage() {
  unavailable();
}

export async function loadLocalMediaStorage() {
  unavailable();
}

export async function loadLocalCmsRegistry() {
  unavailable();
}
