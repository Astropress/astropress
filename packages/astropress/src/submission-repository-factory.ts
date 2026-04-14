import type {
  ContactSubmission,
  SubmissionRepository,
  TestimonialSubmission,
  TestimonialSubmissionInput,
  TestimonialStatus,
  TestimonialSource,
} from "./persistence-types";

export interface AstropressSubmissionRepositoryInput {
  getContactSubmissions: SubmissionRepository["getContactSubmissions"];
  insertContactSubmission(submission: ContactSubmission): void;
  getTestimonials(status?: TestimonialStatus): TestimonialSubmission[];
  insertTestimonial(submission: TestimonialSubmission): void;
  updateTestimonialStatus(id: string, status: TestimonialStatus): { ok: true } | { ok: false; error: string };
}

export function createAstropressSubmissionRepository(
  input: AstropressSubmissionRepositoryInput,
): SubmissionRepository {
  return {
    getContactSubmissions: (...args) => input.getContactSubmissions(...args),
    submitContact(rawInput) {
      const submission: ContactSubmission = {
        id: `contact-${crypto.randomUUID()}`,
        name: rawInput.name,
        email: rawInput.email,
        message: rawInput.message,
        submittedAt: rawInput.submittedAt,
      };

      input.insertContactSubmission(submission);
      return { ok: true as const, submission };
    },
    getTestimonials: (...args) => input.getTestimonials(...args),
    submitTestimonial(rawInput: TestimonialSubmissionInput) {
      const id = `testimonial-${crypto.randomUUID()}`;
      const submission: TestimonialSubmission = {
        id,
        name: rawInput.name,
        email: rawInput.email,
        company: rawInput.company,
        role: rawInput.role,
        beforeState: rawInput.beforeState,
        transformation: rawInput.transformation,
        specificResult: rawInput.specificResult,
        consentToPublish: rawInput.consentToPublish,
        status: "pending",
        source: rawInput.source as TestimonialSource,
        submittedAt: rawInput.submittedAt,
      };
      input.insertTestimonial(submission);
      return { ok: true as const, id };
    },
    moderateTestimonial(id: string, status: TestimonialStatus) {
      return input.updateTestimonialStatus(id, status);
    },
  };
}
