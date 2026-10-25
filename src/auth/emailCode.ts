/**
 * Email one-time code login: the ONLY place that creates, stores, sends and checks login codes.
 *
 * Today this uses the server's own 8-character code (hashed in auth.magic_link_code_hash, 5 minute TTL,
 * single use). When Cognito takes over, replace the bodies of sendLoginCode and verifyLoginCode in this
 * file (signup verification and login OTP both go through Cognito); callers in authService do not change.
 */
import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword } from '../lib/hash.js';
import { generateMagicLinkCode, normalizeMagicLinkCode } from '../lib/magicLinkCode.js';
import { sendMagicLinkEmail } from '../services/emailService.js';

const CODE_TTL_MS = 5 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isWellFormedEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/**
 * Create a fresh code for the account with this email (if any), store its hash, and email the plain code.
 * Never reveals whether the email exists; send failures are logged, not thrown.
 */
export async function sendLoginCode(emailRaw: string): Promise<void> {
  const email = emailRaw.trim();
  if (!isWellFormedEmail(email)) return;

  const user = await prisma.auth.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true },
  });
  if (!user) return;

  const plain = generateMagicLinkCode();
  const hash = await hashPassword(plain);
  await prisma.auth.update({
    where: { id: user.id },
    data: {
      magic_link_code_hash: hash,
      magic_link_expires_at: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  try {
    await sendMagicLinkEmail(user.email, plain);
  } catch (err) {
    console.error('Login code email send failed:', (err as Error).message);
  }
}

/**
 * Check a code for this email. On success the code is consumed and the account { id, role } is returned.
 * Returns null for any failure (unknown email, wrong or expired code, malformed input).
 */
export async function verifyLoginCode(
  emailRaw: string,
  codeRaw: string
): Promise<{ id: string; role: string | null } | null> {
  const email = emailRaw.trim();
  const code = normalizeMagicLinkCode(codeRaw);
  if (!isWellFormedEmail(email) || code.length !== 8) return null;

  const user = await prisma.auth.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: {
      id: true,
      role: true,
      magic_link_code_hash: true,
      magic_link_expires_at: true,
    },
  });
  if (!user?.magic_link_code_hash || !user.magic_link_expires_at) return null;
  if (new Date() > user.magic_link_expires_at) return null;

  const match = await comparePassword(code, user.magic_link_code_hash);
  if (!match) return null;

  await prisma.auth.update({
    where: { id: user.id },
    data: { magic_link_code_hash: null, magic_link_expires_at: null },
  });
  return { id: user.id, role: user.role };
}
