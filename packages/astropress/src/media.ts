import {
	getCloudflareBindings,
	getStringRuntimeValue,
	isProductionRuntime,
} from "./runtime-env";

export interface MediaRecord {
	id: string;
	sourceUrl: string | null;
	localPath: string;
	r2Key: string | null;
}

interface MediaResolutionOptions {
	mode: "development" | "deployment";
	r2BaseUrl?: string;
}

export function resolveMediaUrl(
	record: MediaRecord,
	options: MediaResolutionOptions,
) {
	if (options.mode === "development") {
		return record.localPath;
	}

	if (!options.r2BaseUrl || !record.r2Key) {
		return record.localPath;
	}

	return `${options.r2BaseUrl.replace(/\/$/, "")}/${record.r2Key}`;
}

export function getRuntimeMediaResolutionOptions(
	locals?: App.Locals | null,
): MediaResolutionOptions {
	const bindings = getCloudflareBindings(locals);
	const r2BaseUrl = getStringRuntimeValue("PUBLIC_R2_BASE_URL", locals);
	const useDeploymentMode =
		Boolean(r2BaseUrl || bindings.MEDIA_BUCKET) || isProductionRuntime();
	return {
		mode: useDeploymentMode ? "deployment" : "development",
		r2BaseUrl,
	};
}

export function resolveRuntimeMediaUrl(
	record: MediaRecord,
	locals?: App.Locals | null,
) {
	return resolveMediaUrl(record, getRuntimeMediaResolutionOptions(locals));
}
