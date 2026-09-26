import nodemailer from "nodemailer";
import { appendFileSync } from "node:fs";
import { config } from "../config.js";

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined
});

export async function sendVerificationEmail(to: string, code: string) {
  if (!config.smtp.host) {
    // No SMTP configured (e.g. local dev) — log instead of sending.
    console.log(`[email] verification code for ${to}: ${code}`);
    // For automated/local testing, also write it somewhere a test script can read.
    if (process.env.DEV_CODE_FILE) {
      appendFileSync(process.env.DEV_CODE_FILE, JSON.stringify({ to, code, at: Date.now() }) + "\n");
    }
    return;
  }
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: "Verify your Monad Memory Challenge account",
    text: `Your verification code is ${code}. It expires in 15 minutes.`,
    html: `<p>Your verification code is <strong>${code}</strong>. It expires in 15 minutes.</p>`
  });
}
