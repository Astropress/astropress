import type { APIRoute } from "astro";
import { withAdminFormAction } from "@astropress-diy/astropress";
import { isRestorableTable, restoreRuntimeRecord } from "../../../src/runtime-actions-restore";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin", requireAdmin: true }, async ({ actor, formData, locals, redirect, fail }) => {
    const table = String(formData.get("table") ?? "");
    const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
    const returnTo = String(formData.get("return_to") ?? "/ap-admin");

    if (!isRestorableTable(table)) {
      return fail("Invalid table");
    }

    if (!Number.isFinite(id) || id <= 0) {
      return fail("Invalid id");
    }

    const result = await restoreRuntimeRecord(table, id, actor, locals);
    if (!result.ok) {
      return fail(result.error);
    }

    return redirect(`${returnTo}?restored=1`);
  });
