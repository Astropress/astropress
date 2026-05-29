export async function safeAdminValue<TLoad extends () => Promise<unknown>>(
	load: TLoad,
	fallback: Awaited<ReturnType<TLoad>>,
): Promise<Awaited<ReturnType<TLoad>>> {
	try {
		// TLoad's return type isn't reducible inside the generic body, so the
		// awaited value widens to unknown; the call site guarantees the shape.
		return (await load()) as Awaited<ReturnType<TLoad>>;
	} catch {
		return fallback;
	}
}

export async function safeAdminData<TLoaders extends Record<string, () => Promise<unknown>>>(
	loaders: TLoaders,
	fallbacks: { [K in keyof TLoaders]: Awaited<ReturnType<TLoaders[K]>> },
): Promise<{ [K in keyof TLoaders]: Awaited<ReturnType<TLoaders[K]>> }> {
	const result = { ...fallbacks } as {
		[K in keyof TLoaders]: Awaited<ReturnType<TLoaders[K]>>;
	};

	for (const key of Object.keys(loaders) as Array<keyof TLoaders>) {
		try {
			result[key] = (await loaders[key]()) as (typeof result)[typeof key];
		} catch {
			result[key] = fallbacks[key];
		}
	}

	return result;
}
