import nodemailer from "nodemailer";
import { appendFileSync } from "node:fs";
import { config } from "../config.js";

const smtpTransporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined
    })
  : undefined;

async function sendViaResend(to: string, subject: string, text: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: config.emailFrom, to, subject, text, html })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

export async function sendVerificationEmail(to: string, code: string) {
  const subject = "Verify your Monad Memory Challenge account";
  const text = `Your verification code is ${code}. It expires in 15 minutes.`;
  const html = `<p>Your verification code is <strong>${code}</strong>. It expires in 15 minutes.</p>`;

  if (config.resendApiKey) {
    await sendViaResend(to, subject, text, html);
    return;
  }

  if (smtpTransporter) {
    await smtpTransporter.sendMail({ from: config.smtp.from, to, subject, text, html });
    return;
  }

  // No provider configured (local dev) — log instead of sending, and optionally
  // write it somewhere a test script can read (see backend/src/e2e/run.ts).
  console.log(`[email] no RESEND_API_KEY/SMTP configured — verification code for ${to}: ${code}`);
  if (process.env.DEV_CODE_FILE) {
    appendFileSync(process.env.DEV_CODE_FILE, JSON.stringify({ to, code, at: Date.now() }) + "\n");
  }
}
