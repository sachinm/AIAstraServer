import { prisma } from './lib/prisma.js';
import { hashPassword } from './lib/hash.js';
import { encrypt } from './lib/encrypt.js';

const SUPERADMIN_USERNAME = process.env.SUPERADMIN_USERNAME || 'superadmin';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD;
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@adastra.local';

/**
 * Ensures the default superadmin user exists. Call once at server startup.
 */
export async function ensureSuperadmin(): Promise<void> {
  if (!SUPERADMIN_PASSWORD || SUPERADMIN_PASSWORD.length < 16) {
    console.warn(
      '⚠️ SUPERADMIN_PASSWORD not set or too short (min 16 chars). Set SUPERADMIN_PASSWORD in .env to enable default superadmin.'
    );
    return;
  }

  const hashedPassword = await hashPassword(SUPERADMIN_PASSWORD);

  try {
    const existing = await prisma.auth.findFirst({
      where: { username: SUPERADMIN_USERNAME },
      select: { id: true, role: true },
    });

    if (existing) {
      try {
        await prisma.auth.update({
          where: { id: existing.id },
          data: {
            password: hashedPassword,
            email: SUPERADMIN_EMAIL,
            role: 'superadmin',
          },
        });
      } catch {
        await prisma.auth.update({
          where: { id: existing.id },
          data: { password: hashedPassword, email: SUPERADMIN_EMAIL },
        });
      }
      console.log(
        `✅ Superadmin "${SUPERADMIN_USERNAME}" already exists, credentials updated.`
      );
      return;
    }

    await prisma.auth.create({
      data: {
        username: SUPERADMIN_USERNAME,
        password: hashedPassword,
        email: SUPERADMIN_EMAIL,
        date_of_birth: encrypt('1990-01-01') ?? '1990-01-01',
        place_of_birth: null,
        time_of_birth: null,
        gender: null,
        is_active: true,
        kundli_added: false,
        role: 'superadmin',
      },
    });
    console.log(
      `✅ Superadmin "${SUPERADMIN_USERNAME}" created. Use this account to log in.`
    );
  } catch (err) {
    console.error('Failed to ensure superadmin:', (err as Error).message);
  }
}
