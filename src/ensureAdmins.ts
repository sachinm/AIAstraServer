/**
 * Admin bootstrap (docs/admin/01 §4.1.3). For each address in ADMIN_EMAILS (comma list, case-insensitive): if an `auth`
 * row with that email exists and its canonical role is not aiastra_admin, its role is set to aiastra_admin. It never
 * creates a row and never touches a password; a person not yet signed up is promoted at the first boot after they do.
 * Requests read the role from the row (src/auth/requestAuth.ts), so the promotion applies within 30 s without a new token.
 */
import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from './lib/prisma.js';
import { canonicalRole } from './auth/roles.js';

export function adminEmailsFrom(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.ADMIN_EMAILS ?? '';
  return [...new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))];
}

/** Returns how many rows were promoted. Never throws: a failure is logged without the address. */
export async function ensureAdmins(
  db: Pick<PrismaClient, 'auth'> = defaultPrisma,
  env: NodeJS.ProcessEnv = process.env
): Promise<number> {
  const emails = adminEmailsFrom(env);
  if (!emails.length) return 0;
  let promoted = 0;
  for (const email of emails) {
    try {
      const rows = await db.auth.findMany({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, role: true },
      });
      for (const row of rows) {
        if (canonicalRole(row.role) === 'aiastra_admin') continue;
        await db.auth.update({ where: { id: row.id }, data: { role: 'aiastra_admin' } });
        promoted += 1;
      }
    } catch (err) {
      console.error(JSON.stringify({ msg: 'ensureAdmins: promotion failed', code: (err as { code?: string }).code ?? (err as Error).name }));
    }
  }
  console.log(JSON.stringify({ msg: 'ensureAdmins', listed: emails.length, promoted }));
  return promoted;
}
