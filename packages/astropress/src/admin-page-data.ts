export async function safeAdminValue<TLoad extends () => Promise<any>>(
  load: TLoad,
  fallback: Awaited<ReturnType<TLoad>>,
): Promise<Awaited<ReturnType<TLoad>>> {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

export async function safeAdminData<TLoaders extends Record<string, () => Promise<any>>>(
  loaders: TLoaders,
  fallbacks: { [K in keyof TLoaders]: Awaited<ReturnType<TLoaders[K]>> },
): Promise<{ [K in keyof TLoaders]: Awaited<ReturnType<TLoaders[K]>> }> {
  const result = { ...fallbacks } as { [K in keyof TLoaders]: Awaited<ReturnType<TLoaders[K]>> };

  for (const key of Object.keys(loaders) as Array<keyof TLoaders>) {
    try {
      result[key] = await loaders[key]();
    } catch {
      result[key] = fallbacks[key];
    }
  }

  return result;
}
