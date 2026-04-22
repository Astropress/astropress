import type { APIContext } from "astro";
import { getNewsletterConfig } from "./runtime-env";
import { createLogger } from "./runtime-logger";

const logger = createLogger("MailchimpImport");

export interface MailchimpImportResult {
	ok: boolean;
	imported: number;
	skipped: number;
	error?: string;
}

/**
 * Parses a Mailchimp audience CSV export.
 * Required column: "Email Address"
 * Optional columns: "First Name", "Last Name"
 * Returns cleaned subscriber records ready for Listmonk bulk import.
 */
function parseMailchimpCsv(
	csv: string,
): Array<{ email: string; name: string }> {
	const lines = csv.trim().split(/\r?\n/);
	if (lines.length < 2) return [];

	const headers = lines[0]
		?.split(",")
		.map((h) => h.replace(/^"|"$/g, "").trim());
	const emailIdx = headers.findIndex(
		(h) => h.toLowerCase() === "email address",
	);
	const firstIdx = headers.findIndex((h) => h.toLowerCase() === "first name");
	const lastIdx = headers.findIndex((h) => h.toLowerCase() === "last name");

	if (emailIdx === -1) return [];

	const records: Array<{ email: string; name: string }> = [];
	for (let i = 1; i < lines.length; i++) {
		const cols = lines[i]
			?.split(",")
			.map((c) => c.replace(/^"|"$/g, "").trim());
		const email = cols[emailIdx] ?? "";
		if (!email || !email.includes("@")) continue;
		const first = firstIdx !== -1 ? (cols[firstIdx] ?? "") : "";
		const last = lastIdx !== -1 ? (cols[lastIdx] ?? "") : "";
		const name = [first, last].filter(Boolean).join(" ") || email;
		records.push({ email, name });
	}
	return records;
}

export async function runMailchimpImport(
	csvText: string,
	locals: APIContext["locals"],
): Promise<MailchimpImportResult> {
	const cfg = getNewsletterConfig(locals);

	if (
		cfg.mode !== "listmonk" ||
		!cfg.listmonkApiUrl ||
		!cfg.listmonkApiUsername ||
		!cfg.listmonkApiPassword ||
		!cfg.listmonkListId
	) {
		return {
			ok: false,
			imported: 0,
			skipped: 0,
			error:
				"Listmonk is not configured. Set NEWSLETTER_DELIVERY, LISTMONK_API_URL, LISTMONK_API_USERNAME, LISTMONK_API_PASSWORD, and LISTMONK_LIST_ID.",
		};
	}

	const records = parseMailchimpCsv(csvText);
	if (records.length === 0) {
		return {
			ok: false,
			imported: 0,
			skipped: 0,
			error:
				'No valid subscriber rows found. Make sure the file has an "Email Address" column.',
		};
	}

	const auth = btoa(`${cfg.listmonkApiUsername}:${cfg.listmonkApiPassword}`);
	const listId = Number(cfg.listmonkListId);

	// Listmonk bulk import: POST /api/subscribers/import with CSV records string
	const csvBody = [
		"email,name",
		...records.map((r) => `${r.email},${r.name}`),
	].join("\n");

	try {
		const res = await fetch(`${cfg.listmonkApiUrl}/api/subscribers/import`, {
			method: "POST",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				mode: "subscribe",
				subscription_status: "confirmed",
				delims: ",",
				lists: [listId],
				records: csvBody,
			}),
		});

		if (!res.ok) {
			const body = await res.text();
			logger.error("Listmonk bulk import error", { status: res.status, body });
			return {
				ok: false,
				imported: 0,
				skipped: 0,
				error: `Listmonk returned ${res.status}. Check your credentials.`,
			};
		}

		logger.info("Mailchimp import completed", { count: records.length });
		return { ok: true, imported: records.length, skipped: 0 };
	} catch (err) {
		logger.error("Mailchimp import network error", { err });
		return {
			ok: false,
			imported: 0,
			skipped: 0,
			error: "Network error reaching Listmonk. Check LISTMONK_API_URL.",
		};
	}
}
