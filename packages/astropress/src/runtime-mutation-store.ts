// ─── Runtime Mutation Store ───────────────────────────────────────────────────
// Extracted from runtime-page-store.ts to keep that file under the 400-line limit.

import { createD1AdminMutationStore } from "./d1-admin-store";
import { safeLoadLocalAdminStore } from "./admin-store-dispatch";
import { getCloudflareBindings } from "./runtime-env";
import type { TestimonialSubmissionInput, TestimonialStatus } from "./persistence-types";

function createStaticMutationStore() {
  return {
    submissions: {
      submitContact: async (input: { name: string; email: string; message: string; submittedAt: string }) => ({
        ok: true as const,
        submission: {
          id: crypto.randomUUID(),
          ...input,
        },
      }),
      submitTestimonial: async (input: TestimonialSubmissionInput) => ({
        ok: true as const,
        id: `testimonial-${crypto.randomUUID()}`,
      }),
      moderateTestimonial: async (_id: string, _status: TestimonialStatus, _actorEmail: string) => ({
        ok: true as const,
      }),
    },
    comments: {
      submitPublicComment: async (input: {
        author: string;
        email: string;
        body: string;
        route: string;
        submittedAt: string;
      }) => ({
        ok: true as const,
        comment: {
          id: crypto.randomUUID(),
          status: "pending" as const,
          policy: "open-moderated" as const,
          ...input,
        },
      }),
    },
    rateLimits: {
      checkRateLimit: async () => true,
      peekRateLimit: async () => true,
      recordFailedAttempt: async () => {},
    },
  };
}

async function getMutationStore(locals?: App.Locals | null) {
  const db = getCloudflareBindings(locals).DB;

  if (db) {
    return createD1AdminMutationStore(db);
  }

  const localAdminStore = await safeLoadLocalAdminStore();
  if (!localAdminStore) {
    return createStaticMutationStore();
  }

  return {
    submissions: {
      submitContact: async (input: { name: string; email: string; message: string; submittedAt: string }) =>
        localAdminStore.submitContact(input),
      submitTestimonial: async (input: TestimonialSubmissionInput) =>
        localAdminStore.submitTestimonial(input),
      moderateTestimonial: async (id: string, status: TestimonialStatus, actorEmail: string) =>
        localAdminStore.moderateTestimonial(id, status, { email: actorEmail, role: "admin", name: actorEmail }),
    },
    comments: {
      submitPublicComment: async (input: {
        author: string;
        email: string;
        body: string;
        route: string;
        submittedAt: string;
      }) => localAdminStore.submitPublicComment(input),
    },
    rateLimits: {
      checkRateLimit: async (key: string, max: number, windowMs: number) => localAdminStore.checkRateLimit(key, max, windowMs),
      peekRateLimit: async (key: string, max: number, windowMs: number) => localAdminStore.peekRateLimit(key, max, windowMs),
      recordFailedAttempt: async (key: string, max: number, windowMs: number) => localAdminStore.recordFailedAttempt(key, max, windowMs),
    },
  };
}

export async function checkRuntimeRateLimit(key: string, max: number, windowMs: number, locals?: App.Locals | null) {
  return (await getMutationStore(locals)).rateLimits.checkRateLimit(key, max, windowMs);
}

export async function peekRuntimeRateLimit(key: string, max: number, windowMs: number, locals?: App.Locals | null) {
  return (await getMutationStore(locals)).rateLimits.peekRateLimit(key, max, windowMs);
}

export async function recordRuntimeFailedAttempt(key: string, max: number, windowMs: number, locals?: App.Locals | null) {
  return (await getMutationStore(locals)).rateLimits.recordFailedAttempt(key, max, windowMs);
}

export async function submitRuntimeContact(
  input: { name: string; email: string; message: string; submittedAt: string },
  locals?: App.Locals | null,
) {
  return (await getMutationStore(locals)).submissions.submitContact(input);
}

export async function submitRuntimePublicComment(
  input: { author: string; email: string; body: string; route: string; submittedAt: string },
  locals?: App.Locals | null,
) {
  return (await getMutationStore(locals)).comments.submitPublicComment(input);
}

export async function submitRuntimeTestimonial(
  input: TestimonialSubmissionInput,
  locals?: App.Locals | null,
) {
  return (await getMutationStore(locals)).submissions.submitTestimonial(input);
}

export async function moderateRuntimeTestimonial(
  id: string,
  status: TestimonialStatus,
  actor: { email: string; role: string; name: string },
  locals?: App.Locals | null,
) {
  return (await getMutationStore(locals)).submissions.moderateTestimonial(id, status, actor.email);
}
