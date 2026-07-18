import { Resend } from "resend";
import nodemailer from "nodemailer";
import { ROLE_LABELS, type MemberRole } from "@/lib/types";

export interface InviteEmailInput {
  to: string;
  projectName: string;
  inviterEmail: string | null;
  role: MemberRole;
  joinUrl: string;
}

export interface SendResult {
  sent: boolean;
  error?: string;
}

/**
 * Send a project-invitation email. Transport preference:
 *   1. Gmail SMTP  - if GMAIL_USER + GMAIL_APP_PASSWORD are set (reaches any
 *      recipient, no domain needed).
 *   2. Resend      - if RESEND_API_KEY is set.
 *   3. none        - returns { sent: false }; invites still work (accept flow).
 * Never throws.
 */
export async function sendInviteEmail(input: InviteEmailInput): Promise<SendResult> {
  const subject = `You've been invited to ${input.projectName} on Testing 101`;
  const html = renderInviteHtml(input);
  const text = renderInviteText(input);

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    return sendViaGmail(gmailUser, gmailPass, input.to, subject, html, text);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    return sendViaResend(apiKey, input.to, subject, html, text);
  }

  return {
    sent: false,
    error: "No email provider configured (set GMAIL_APP_PASSWORD or RESEND_API_KEY)",
  };
}

async function sendViaGmail(
  user: string,
  pass: string,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<SendResult> {
  try {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
    await transport.sendMail({
      from: `"Testing 101" <${user}>`,
      to,
      subject,
      html,
      text,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Gmail send failed" };
  }
}

async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<SendResult> {
  const from = process.env.RESEND_FROM || "Testing 101 <onboarding@resend.dev>";
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from, to, subject, html, text });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Failed to send email" };
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderInviteText(i: InviteEmailInput): string {
  const who = i.inviterEmail ? `${i.inviterEmail} has invited you` : "You've been invited";
  return [
    `${who} to join the project "${i.projectName}" on Testing 101 Bug Tracker as a ${ROLE_LABELS[i.role].toLowerCase()}.`,
    ``,
    `Accept the invitation: ${i.joinUrl}`,
    ``,
    `Sign in (or sign up) with this email address, then Accept the invitation from your dashboard. You can also decline it.`,
  ].join("\n");
}

function renderInviteHtml(i: InviteEmailInput): string {
  const who = i.inviterEmail
    ? `<strong>${esc(i.inviterEmail)}</strong> has invited you`
    : "You've been invited";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:24px 32px;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:18px;font-weight:bold;color:#2563eb;">Testing</span>
            <span style="font-size:18px;font-weight:bold;color:#1e293b;"> 101</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 12px;font-size:20px;color:#1e293b;">You're invited to a project</h1>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
              ${who} to join <strong>${esc(i.projectName)}</strong> on the Testing 101 Bug Tracker
              as a <strong>${esc(ROLE_LABELS[i.role].toLowerCase())}</strong>.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#2563eb;">
              <a href="${esc(i.joinUrl)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">
                Accept invitation
              </a>
            </td></tr></table>
            <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
              Sign in (or sign up) with this email address - <strong>${esc(i.to)}</strong> - then
              Accept the invitation from your dashboard (you can also decline it). If the button
              doesn't work, copy this link:<br>
              <a href="${esc(i.joinUrl)}" style="color:#2563eb;word-break:break-all;">${esc(i.joinUrl)}</a>
            </p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">Testing 101 - QA toolkit</p>
      </td></tr>
    </table>
  </body>
</html>`;
}
