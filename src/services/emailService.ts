import { getNodeEnv } from '../config/env.js';
import { maskEmail } from '../lib/logRedact.js';

export interface PlainEmail {
  to: string[];
  subject: string;
  text: string;
  /** aborts a Resend call; the SMTP path is bounded by its own connection/socket timeouts */
  timeoutMs?: number;
}

function mailFrom(): string {
  return process.env.MAIL_FROM?.trim() || process.env.RESEND_FROM?.trim() || 'AdAstra AI <onboarding@resend.dev>';
}

/**
 * Send a plain-text email through Resend (RESEND_API_KEY) or SMTP (SMTP_HOST). Returns false when neither is configured,
 * so the caller decides what an unconfigured environment means; throws on a send failure.
 */
export async function sendPlainEmail(mail: PlainEmail): Promise<boolean> {
  const from = mailFrom();
  const { to, subject, text, timeoutMs } = mail;
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text }),
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error ${res.status}: ${err}`);
    }
    return true;
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  if (smtpHost) {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || '587'),
      secure:
        process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || '',
          }
        : undefined,
      ...(timeoutMs ? { connectionTimeout: timeoutMs, greetingTimeout: timeoutMs, socketTimeout: timeoutMs } : {}),
    });
    await transporter.sendMail({ from, to: to.join(', '), subject, text });
    return true;
  }
  return false;
}

/**
 * Send magic-link code email. Configure one of:
 * - RESEND_API_KEY + MAIL_FROM (Resend REST API)
 * - SMTP_HOST (+ SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE) via nodemailer
 * Local/dev without config: logs the code to console (never in production).
 */
export async function sendMagicLinkEmail(to: string, code: string): Promise<void> {
  const subject =
    process.env.MAGIC_LINK_EMAIL_SUBJECT?.trim() || 'Your sign-in code';
  const text = `Your sign-in code is ${code}. It expires in 5 minutes. If you did not request this, you can ignore this email.`;

  if (await sendPlainEmail({ to: [to], subject, text })) return;

  const env = getNodeEnv();
  // local only, never on a Lambda: the masked recipient, and the code so a developer can sign in without mail
  if ((env === 'local' || env === 'development') && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    console.warn('[email] No RESEND_API_KEY or SMTP_HOST; sign-in code (local log only):', {
      to: maskEmail(to),
      code,
    });
    return;
  }

  throw new Error('Email not configured: set RESEND_API_KEY or SMTP_HOST');
}
