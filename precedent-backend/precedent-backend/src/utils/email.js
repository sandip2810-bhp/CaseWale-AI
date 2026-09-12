// Thin wrapper around the Resend API. Uses plain fetch (same pattern as
// utils/ai.js) instead of the Resend SDK so there's no extra dependency.
//
// Required env vars:
//   RESEND_API_KEY   - from https://resend.com/api-keys
//   RESEND_FROM_EMAIL - a verified sender, e.g. "CaseWale <notify@yourdomain.com>"
//   FRONTEND_URL     - e.g. "http://localhost:5500" (used to build links in emails)

require("dotenv").config();

async function sendEmail({ to, subject, html }) {
    if (!process.env.RESEND_API_KEY) {
        console.warn(
            "RESEND_API_KEY is not set — skipping email send:",
            subject
        );
        return { skipped: true };
    }

    const from =
        process.env.RESEND_FROM_EMAIL || "CaseWale <onboarding@resend.dev>";

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({ from, to, subject, html }),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error("Resend API error:", errText);
        throw new Error(`Resend API error (${response.status}): ${errText}`);
    }

    return response.json();
}

function frontendUrl(path) {
    const base = (process.env.FRONTEND_URL || "http://localhost:5500").replace(
        /\/$/,
        ""
    );
    return `${base}${path}`;
}

function wrapEmail(title, bodyHtml) {
    return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#16130b; padding:32px; color:#eae1d4;">
      <div style="max-width:480px; margin:0 auto; background:#1f1b13; border:1px solid #38342b; border-radius:12px; padding:32px;">
        <h1 style="color:#f2ca50; font-size:20px; margin:0 0 16px;">${title}</h1>
        ${bodyHtml}
        <p style="color:#99907c; font-size:12px; margin-top:32px;">CaseWale — AI legal information assistant. This is an automated message.</p>
      </div>
    </div>`;
}

async function sendPasswordResetEmail(user, token) {
    const link = frontendUrl(
        `/index.html?view=reset-password&token=${encodeURIComponent(
            token
        )}&email=${encodeURIComponent(user.email)}`
    );

    return sendEmail({
        to: user.email,
        subject: "Reset your CaseWale password",
        html: wrapEmail(
            "Reset your password",
            `<p style="font-size:14px; line-height:22px;">We received a request to reset the password on your CaseWale account. This link expires in 30 minutes.</p>
             <p style="margin:24px 0;"><a href="${link}" style="background:#f2ca50; color:#3c2f00; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px;">Reset password</a></p>
             <p style="font-size:12px; color:#99907c;">If you didn't request this, you can safely ignore this email.</p>`
        ),
    });
}

async function sendDraftReminderEmail(user, draft) {
    const link = frontendUrl(`/dashboard.html?draft=${draft.id}`);

    return sendEmail({
        to: user.email,
        subject: `Reminder: ${draft.title || "Untitled draft"}`,
        html: wrapEmail(
            "Draft reminder",
            `<p style="font-size:14px; line-height:22px;">This is a reminder for a draft you flagged in CaseWale: <strong>${
                draft.title || "Untitled draft"
            }</strong>.</p>
             <p style="margin:24px 0;"><a href="${link}" style="background:#f2ca50; color:#3c2f00; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px;">Open draft</a></p>`
        ),
    });
}

// Sends the actual draft content to a chosen recipient (e.g. the person the
// notice/letter is addressed to) — used by the "email on save" flow.
async function sendDraftContentEmail(toEmail, draft, sender) {
    const title = draft.title || "Untitled draft";

    // Preserve line breaks from the plain-text draft content in the HTML email.
    const contentHtml = String(draft.content || "")
        .split(/\r?\n/)
        .map((line) => line || "&nbsp;")
        .join("<br />");

    const senderLine = sender && sender.name
        ? `<p style="font-size:12px; color:#99907c; margin-top:24px;">Sent by ${sender.name}${
              sender.email ? ` (${sender.email})` : ""
          } via CaseWale.</p>`
        : "";

    return sendEmail({
        to: toEmail,
        subject: title,
        html: wrapEmail(
            title,
            `<div style="font-size:14px; line-height:22px; white-space:pre-wrap;">${contentHtml}</div>${senderLine}`
        ),
    });
}

module.exports = {
    sendEmail,
    sendPasswordResetEmail,
    sendDraftReminderEmail,
    sendDraftContentEmail,
};