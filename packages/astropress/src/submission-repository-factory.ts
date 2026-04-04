import type { ContactSubmission, SubmissionRepository } from "./persistence-types";

export interface AstropressSubmissionRepositoryInput {
  getContactSubmissions: SubmissionRepository["getContactSubmissions"];
  insertContactSubmission(submission: ContactSubmission): void;
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
  };
}
