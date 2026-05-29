import {
	checkUploadSize,
	createRuntimeMediaAsset,
	withAdminFormAction,
} from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/media", requireAction: "media:upload" },
		async ({ actor, formData, locals, redirect, fail }) => {
			const file = formData.get("file");
			if (!(file instanceof File)) {
				return fail("Select a file to upload");
			}

			// #102: reject oversized uploads from File.size BEFORE materialising the
			// whole file into memory. createRuntimeMediaAsset re-checks the bytes as
			// defense-in-depth, but buffering first is the avoidable memory pressure.
			const sizeCheck = checkUploadSize(file.size);
			if (!sizeCheck.ok) {
				return fail(sizeCheck.error);
			}

			const bytes = new Uint8Array(await file.arrayBuffer());
			const result = await createRuntimeMediaAsset(
				{
					filename: file.name,
					bytes,
					mimeType: file.type,
					title: String(formData.get("title") ?? ""),
					altText: String(formData.get("altText") ?? ""),
				},
				actor,
				locals,
			);

			if (!result.ok) {
				return fail(result.error);
			}

			return redirect("/ap-admin/media?saved=1");
		},
	);
