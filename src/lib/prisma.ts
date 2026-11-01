import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

function buildPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;
  if (rawUrl && /connection_limit=1\b/.test(rawUrl)) {
    const updatedUrl = rawUrl
      .replace(/connection_limit=1\b/, 'connection_limit=10')
      .replace(/pool_timeout=\d+/, 'pool_timeout=30');
    const finalUrl = updatedUrl.includes('pool_timeout=')
      ? updatedUrl
      : `${updatedUrl}${updatedUrl.includes('?') ? '&' : '?'}pool_timeout=30`;
    return new PrismaClient({ datasources: { db: { url: finalUrl } } });
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
