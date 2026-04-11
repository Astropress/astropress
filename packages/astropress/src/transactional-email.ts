interface EmailResult {
  ok: boolean;
  error?: string;
  preview?: {
    to: string;
    subject: string;
    html: string;
  };
}

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

import { getTransactionalEmailConfig, isProductionRuntime } from "./runtime-env";
import { peekCmsConfig } from "./config";

function isMockMode(locals?: App.Locals | null) {
  return getTransactionalEmailConfig(locals).mode !== "resend";
}

async function sendResendEmail(message: EmailMessage, locals?: App.Locals | null): Promise<EmailResult> {
  const { apiKey, from } = getTransactionalEmailConfig(locals);

  if (!apiKey || !from) {
    if (isProductionRuntime()) {
      return { ok: false, error: "Transactional email is not configured." };
    }

    return {
      ok: true,
      preview: {
        to: message.to,
        subject: message.subject,
        html: message.html,
      },
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return {
      ok: false,
      error: `Resend error: ${errorBody || response.statusText}`,
    };
  }

  return { ok: true };
}

export async function sendTransactionalEmail(message: EmailMessage, locals?: App.Locals | null): Promise<EmailResult> {
  if (isMockMode(locals)) {
    return {
      ok: true,
      preview: {
        to: message.to,
        subject: message.subject,
        html: message.html,
      },
    };
  }

  return sendResendEmail(message, locals);
}

export async function sendPasswordResetEmail(email: string, resetUrl: string, locals?: App.Locals | null): Promise<EmailResult> {
  const siteName = peekCmsConfig()?.siteName ?? "Astropress";
  return sendTransactionalEmail({
    to: email,
    subject: `Reset your ${siteName} admin password`,
    text: `Use this link to reset your ${siteName} admin password: ${resetUrl}`,
    html: `<p>Use the link below to reset your ${siteName} admin password.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  }, locals);
}

export async function sendUserInviteEmail(email: string, inviteUrl: string, locals?: App.Locals | null): Promise<EmailResult> {
  const siteName = peekCmsConfig()?.siteName ?? "Astropress";
  return sendTransactionalEmail({
    to: email,
    subject: `Accept your ${siteName} admin invitation`,
    text: `Use this link to accept your ${siteName} admin invitation and set your password: ${inviteUrl}`,
    html: `<p>You have been invited to the ${siteName} admin.</p><p>Use the link below to accept the invitation and set your password.</p><p><a href="${inviteUrl}">${inviteUrl}</a></p>`,
  }, locals);
}

export async function sendContactNotification(input: {
  name: string;
  email: string;
  message: string;
  submittedAt: string;
}, locals?: App.Locals | null): Promise<EmailResult> {
  const { contactDestination: destination } = getTransactionalEmailConfig(locals);
  if (!destination) {
    if (isProductionRuntime()) {
      return { ok: false, error: "Contact notification email is not configured." };
    }

    return {
      ok: true,
      preview: {
        to: "admin-preview@example.local",
        subject: `Preview contact submission from ${input.name}`,
        html: `<p>${input.name} (${input.email}) submitted a contact request.</p><p>${input.message}</p>`,
      },
    };
  }

  return sendTransactionalEmail({
    to: destination,
    subject: `${peekCmsConfig()?.siteName ?? "Astropress"} contact submission from ${input.name}`,
    text: `${input.name} <${input.email}> submitted a contact request at ${input.submittedAt}\n\n${input.message}`,
    html: `<p><strong>${input.name}</strong> &lt;${input.email}&gt; submitted a contact request at ${input.submittedAt}.</p><p>${input.message}</p>`,
  }, locals);
}
