import type {
	TestimonialSource,
	TestimonialStatus,
	TestimonialSubmission,
} from "../persistence-types";
import { createAstropressSubmissionRepository } from "../submission-repository-factory";
import type { AstropressSqliteDatabaseLike } from "./utils";

interface TestimonialRow {
	id: string;
	name: string;
	email: string;
	company: string | null;
	role: string | null;
	before_state: string | null;
	transformation: string | null;
	specific_result: string | null;
	consent_to_publish: number;
	status: string;
	source: string;
	submitted_at: string;
	approved_at: string | null;
}

const TESTIMONIAL_COLUMNS =
	"id, name, email, company, role, before_state, transformation, specific_result, consent_to_publish, status, source, submitted_at, approved_at";

function mapTestimonialRow(row: TestimonialRow): TestimonialSubmission {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		company: row.company ?? undefined,
		role: row.role ?? undefined,
		beforeState: row.before_state ?? undefined,
		transformation: row.transformation ?? undefined,
		specificResult: row.specific_result ?? undefined,
		consentToPublish: Number(row.consent_to_publish) === 1,
		status: row.status as TestimonialStatus,
		source: row.source as TestimonialSource,
		submittedAt: row.submitted_at,
		approvedAt: row.approved_at ?? undefined,
	};
}

export function createSqliteSubmissionStore(getDb: () => AstropressSqliteDatabaseLike) {
	function getContactSubmissions() {
		const rows = getDb()
			.prepare(
				"SELECT id, name, email, message, submitted_at FROM contact_submissions ORDER BY datetime(submitted_at) DESC, id DESC",
			)
			.all() as Array<{
			id: string;
			name: string;
			email: string;
			message: string;
			submitted_at: string;
		}>;

		return rows.map((row) => ({
			id: row.id,
			name: row.name,
			email: row.email,
			message: row.message,
			submittedAt: row.submitted_at,
		}));
	}

	function getTestimonials(status?: TestimonialStatus): TestimonialSubmission[] {
		const order = " ORDER BY datetime(submitted_at) DESC, id DESC";
		const rows = (
			status
				? getDb()
						.prepare(
							`SELECT ${TESTIMONIAL_COLUMNS} FROM testimonial_submissions WHERE status = ?${order}`,
						)
						.all(status)
				: getDb()
						.prepare(`SELECT ${TESTIMONIAL_COLUMNS} FROM testimonial_submissions${order}`)
						.all()
		) as TestimonialRow[];
		return rows.map(mapTestimonialRow);
	}

	const sqliteSubmissionRepository = createAstropressSubmissionRepository({
		getContactSubmissions,
		insertContactSubmission(submission) {
			getDb()
				.prepare(
					"INSERT INTO contact_submissions (id, name, email, message, submitted_at) VALUES (?, ?, ?, ?, ?)",
				)
				.run(
					submission.id,
					submission.name,
					submission.email,
					submission.message,
					submission.submittedAt,
				);
		},
		getTestimonials,
		insertTestimonial(submission) {
			getDb()
				.prepare(
					`INSERT INTO testimonial_submissions (${TESTIMONIAL_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					submission.id,
					submission.name,
					submission.email,
					submission.company ?? null,
					submission.role ?? null,
					submission.beforeState ?? null,
					submission.transformation ?? null,
					submission.specificResult ?? null,
					submission.consentToPublish ? 1 : 0,
					submission.status,
					submission.source,
					submission.submittedAt,
					submission.approvedAt ?? null,
				);
		},
		updateTestimonialStatus(id, status) {
			// Stamp approvedAt when a testimonial first becomes publicly visible.
			const approvedAt =
				status === "approved" || status === "featured" ? new Date().toISOString() : null;
			const result = getDb()
				.prepare(
					"UPDATE testimonial_submissions SET status = ?, approved_at = COALESCE(?, approved_at) WHERE id = ?",
				)
				.run(status, approvedAt, id);
			// `changes` is 0 (and falsy) when no row matched the id; 1 on success.
			// Using truthiness avoids a separate, unreachable nullish branch.
			if (!result.changes) {
				return { ok: false as const, error: "Testimonial not found" };
			}
			return { ok: true as const };
		},
	});

	const sqliteSchedulingRepository = {
		schedulePublish(id: string, scheduledAt: string): void {
			getDb()
				.prepare("UPDATE content_overrides SET scheduled_at = ?, status = 'draft' WHERE slug = ?")
				.run(scheduledAt, id);
			getDb()
				.prepare(
					`INSERT INTO content_overrides (slug, scheduled_at, status, title, seo_title, meta_description, updated_at, updated_by)
           SELECT ce.slug, ?, 'draft', ce.title, ce.title, '', CURRENT_TIMESTAMP, 'scheduler'
           FROM content_entries ce WHERE ce.slug = ?
           AND NOT EXISTS (SELECT 1 FROM content_overrides co WHERE co.slug = ?)`,
				)
				.run(scheduledAt, id, id);
		},

		listScheduled(): Array<{
			id: string;
			slug: string;
			title: string;
			scheduledAt: string;
		}> {
			const now = new Date().toISOString();
			const rows = getDb()
				.prepare(
					`SELECT co.slug AS id, co.slug, COALESCE(co.title, ce.title, co.slug) AS title, co.scheduled_at
           FROM content_overrides co LEFT JOIN content_entries ce ON ce.slug = co.slug
           WHERE co.scheduled_at IS NOT NULL AND co.scheduled_at > ? ORDER BY co.scheduled_at ASC`,
				)
				.all(now) as Array<{
				id: string;
				slug: string;
				title: string;
				scheduled_at: string;
			}>;
			return rows.map((r) => ({
				id: r.slug,
				slug: r.slug,
				title: r.title,
				scheduledAt: r.scheduled_at,
			}));
		},

		cancelScheduledPublish(id: string): void {
			getDb().prepare("UPDATE content_overrides SET scheduled_at = NULL WHERE slug = ?").run(id);
		},

		runScheduledPublishes(): number {
			const now = new Date().toISOString();
			const result = getDb()
				.prepare(
					`UPDATE content_overrides SET status = 'published', scheduled_at = NULL WHERE scheduled_at IS NOT NULL AND scheduled_at <= ?`,
				)
				.run(now);
			return result.changes as number;
		},
	};

	return { sqliteSubmissionRepository, sqliteSchedulingRepository };
}
