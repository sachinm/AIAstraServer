import { getNodeEnv } from '../config/env.js';

/**
 * Send magic-link code email. Configure one of:
 * - RESEND_API_KEY + MAIL_FROM (Resend REST API)
 * - SMTP_HOST (+ SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE) via nodemailer
 * Local/dev without config: logs the code to console (never in production).
 */
export async function sendMagicLinkEmail(to: string, code: string): Promise<void> {
  const from =
    process.env.MAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    'AdAstra <onboarding@resend.dev>';
  const subject =
    process.env.MAGIC_LINK_EMAIL_SUBJECT?.trim() || 'Your sign-in code';
  const text = `Your sign-in code is ${code}. It expires in 5 minutes. If you did not request this, you can ignore this email.`;

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error ${res.status}: ${err}`);
    }
    return;
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
    });
    await transporter.sendMail({ from, to, subject, text });
    return;
  }

  const env = getNodeEnv();
  if (env === 'local' || env === 'development') {
    console.warn('[email] No RESEND_API_KEY or SMTP_HOST; magic link (dev log only):', {
      to,
      code,
    });
    return;
  }

  throw new Error('Email not configured: set RESEND_API_KEY or SMTP_HOST');
}
