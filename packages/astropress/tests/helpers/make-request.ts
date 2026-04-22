/**
 * Creates a real POST Request whose body is a FormData with the given fields.
 *
 * Use this instead of constructing a partial object and casting `as unknown as Request`.
 * The real Request object means formData() is a genuine async method with no mocking required.
 */
export function makeFormRequest(
	fields: Record<string, string> = {},
	options: { url?: string; headers?: Headers } = {},
): Request {
	const fd = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		fd.set(key, value);
	}
	return new Request(
		options.url ?? "https://example.com/ap-admin/actions/content-save",
		{
			method: "POST",
			body: fd,
			headers: options.headers,
		},
	);
}
