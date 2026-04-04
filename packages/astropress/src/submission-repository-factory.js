export function createAstropressSubmissionRepository(input) {
  return {
    getContactSubmissions: (...args) => input.getContactSubmissions(...args),
    submitContact(rawInput) {
      const submission = {
        id: `contact-${crypto.randomUUID()}`,
        name: rawInput.name,
        email: rawInput.email,
        message: rawInput.message,
        submittedAt: rawInput.submittedAt,
      };

      input.insertContactSubmission(submission);
      return { ok: true, submission };
    },
  };
}
