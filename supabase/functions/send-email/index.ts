import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type EmailActionType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email"
  | "reauthentication"
  | "password_changed_notification"
  | "email_changed_notification"
  | "phone_changed_notification"
  | "identity_linked_notification"
  | "identity_unlinked_notification"
  | "mfa_factor_enrolled_notification"
  | "mfa_factor_unenrolled_notification"
  | string;

interface HookPayload {
  user: {
    email?: string;
    new_email?: string;
  };
  email_data: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type: EmailActionType;
    site_url?: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

interface EmailMessage {
  html: string;
  subject: string;
  text: string;
  to: string;
}

const resendApiKey = getRequiredEnv("RESEND_API_KEY");
const resendFromEmail = getRequiredEnv("RESEND_FROM_EMAIL");
const sendEmailHookSecret = normalizeHookSecret(getRequiredEnv("SEND_EMAIL_HOOK_SECRET"));
const appName = Deno.env.get("APP_NAME") ?? "Pensieve";
const resendFromName = Deno.env.get("RESEND_FROM_NAME") ?? appName;
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const webhook = new Webhook(sendEmailHookSecret);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let event: HookPayload;

  try {
    event = webhook.verify(payload, headers) as HookPayload;
  } catch (error) {
    console.error("Invalid send-email hook signature", error);
    return jsonError("Invalid hook signature", 401);
  }

  try {
    const messages = buildEmailMessages(event);
    await Promise.all(messages.map(sendWithResend));

    return Response.json({});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send auth email";
    console.error("Could not send auth email", error);
    return jsonError(message, 500);
  }
});

function buildEmailMessages(event: HookPayload): EmailMessage[] {
  const { user, email_data: emailData } = event;
  const actionType = emailData.email_action_type;

  if (actionType === "email_change") {
    return buildEmailChangeMessages(event);
  }

  if (!user.email) {
    throw new Error("Supabase hook payload did not include a recipient email.");
  }

  return [
    buildEmail({
      actionType,
      recipient: user.email,
      token: emailData.token,
      tokenHash: emailData.token_hash,
      redirectTo: emailData.redirect_to,
    }),
  ];
}

function buildEmailChangeMessages(event: HookPayload): EmailMessage[] {
  const { user, email_data: emailData } = event;
  const messages: EmailMessage[] = [];

  if (user.email && emailData.token && emailData.token_hash_new) {
    messages.push(
      buildEmail({
        actionType: "email_change",
        recipient: user.email,
        token: emailData.token,
        tokenHash: emailData.token_hash_new,
        redirectTo: emailData.redirect_to,
        intro: "Confirm that you want to change the email address on your account.",
      })
    );
  }

  if (user.new_email && (emailData.token_new || emailData.token) && emailData.token_hash) {
    messages.push(
      buildEmail({
        actionType: "email_change",
        recipient: user.new_email,
        token: emailData.token_new ?? emailData.token,
        tokenHash: emailData.token_hash,
        redirectTo: emailData.redirect_to,
        intro: "Confirm this new email address for your account.",
      })
    );
  }

  if (messages.length === 0) {
    throw new Error("Supabase email change payload did not include enough email data.");
  }

  return messages;
}

function buildEmail({
  actionType,
  intro,
  recipient,
  redirectTo,
  token,
  tokenHash,
}: {
  actionType: EmailActionType;
  intro?: string;
  recipient: string;
  redirectTo?: string;
  token?: string;
  tokenHash?: string;
}): EmailMessage {
  const subject = getSubject(actionType);
  const verifyUrl = tokenHash ? buildVerifyUrl(actionType, tokenHash, redirectTo) : null;
  const lead = intro ?? getIntro(actionType);
  const escapedAppName = escapeHtml(appName);
  const escapedLead = escapeHtml(lead);
  const escapedSubject = escapeHtml(subject);
  const escapedVerifyUrl = verifyUrl ? escapeHtml(verifyUrl) : null;
  const escapedToken = token ? escapeHtml(token) : null;

  const actionHtml = escapedVerifyUrl
    ? `<p><a href="${escapedVerifyUrl}" style="display:inline-block;background:#1f2937;color:#ffffff;text-decoration:none;border-radius:6px;padding:12px 18px;font-weight:600;">Continue to ${escapedAppName}</a></p>`
    : "";
  const tokenHtml = escapedToken
    ? `<p style="margin-top:24px;">Your one-time code is:</p><p style="font-size:24px;letter-spacing:4px;font-weight:700;">${escapedToken}</p>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f7f7f5;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 16px;">${escapedSubject}</h1>
      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">${escapedLead}</p>
      ${actionHtml}
      ${tokenHtml}
      <p style="font-size:14px;line-height:1.6;color:#6b7280;margin-top:32px;">If you did not request this, you can ignore this email.</p>
      <p style="font-size:12px;line-height:1.6;color:#9ca3af;margin-top:28px;">${escapedAppName}</p>
    </div>
  </body>
</html>`;

  const lines = [
    subject,
    "",
    lead,
    verifyUrl ? `Open this link: ${verifyUrl}` : null,
    token ? `One-time code: ${token}` : null,
    "",
    "If you did not request this, you can ignore this email.",
  ].filter(Boolean);

  return {
    html,
    subject,
    text: lines.join("\n"),
    to: recipient,
  };
}

function getSubject(actionType: EmailActionType): string {
  switch (actionType) {
    case "signup":
    case "magiclink":
    case "email":
      return `Sign in to ${appName}`;
    case "invite":
      return `You have been invited to ${appName}`;
    case "recovery":
      return `Reset your ${appName} password`;
    case "email_change":
      return `Confirm your ${appName} email change`;
    case "reauthentication":
      return `Confirm your ${appName} session`;
    case "password_changed_notification":
      return `${appName} password changed`;
    case "email_changed_notification":
      return `${appName} email changed`;
    case "phone_changed_notification":
      return `${appName} phone changed`;
    case "identity_linked_notification":
      return `New sign-in method linked to ${appName}`;
    case "identity_unlinked_notification":
      return `Sign-in method removed from ${appName}`;
    case "mfa_factor_enrolled_notification":
      return `MFA enabled for ${appName}`;
    case "mfa_factor_unenrolled_notification":
      return `MFA changed for ${appName}`;
    default:
      return `${appName} authentication`;
  }
}

function getIntro(actionType: EmailActionType): string {
  switch (actionType) {
    case "signup":
    case "magiclink":
    case "email":
      return "Use this secure link or one-time code to sign in.";
    case "invite":
      return "Use this secure link to accept the invitation.";
    case "recovery":
      return "Use this secure link or one-time code to reset your password.";
    case "reauthentication":
      return "Use this one-time code to confirm your session.";
    case "password_changed_notification":
      return "Your password was changed.";
    case "email_changed_notification":
      return "Your account email address was changed.";
    case "phone_changed_notification":
      return "Your account phone number was changed.";
    case "identity_linked_notification":
      return "A new sign-in method was linked to your account.";
    case "identity_unlinked_notification":
      return "A sign-in method was removed from your account.";
    case "mfa_factor_enrolled_notification":
      return "Multi-factor authentication was enabled for your account.";
    case "mfa_factor_unenrolled_notification":
      return "Multi-factor authentication settings changed for your account.";
    default:
      return "Use this email to continue your authentication flow.";
  }
}

function buildVerifyUrl(actionType: EmailActionType, tokenHash: string, redirectTo?: string): string {
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("SUPABASE_URL is required to build auth verification links.");
  }

  const url = new URL(`${baseUrl}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", actionType);
  if (redirectTo) {
    url.searchParams.set("redirect_to", redirectTo);
  }

  return url.toString();
}

async function sendWithResend(message: EmailMessage): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: formatFromAddress(resendFromName, resendFromEmail),
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend returned ${response.status}: ${errorBody}`);
  }
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function normalizeHookSecret(secret: string): string {
  return secret.replace(/^v1,whsec_/, "");
}

function formatFromAddress(name: string, email: string): string {
  const safeName = name.replace(/[\r\n"]/g, "").trim();
  return safeName ? `${safeName} <${email}>` : email;
}

function jsonError(message: string, status: number): Response {
  return Response.json(
    {
      error: {
        http_code: status,
        message,
      },
    },
    { status }
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
