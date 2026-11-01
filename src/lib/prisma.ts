import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

function buildPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;
  if (rawUrl) {
    let url = rawUrl;
    if (/connection_limit=1\b/.test(url)) {
      url = url.replace(/connection_limit=1\b/, 'connection_limit=5');
    } else if (!/connection_limit=\d+/.test(url)) {
      url = `${url}${url.includes('?') ? '&' : '?'}connection_limit=5`;
    }
    if (!/pool_timeout=\d+/.test(url)) {
      url = `${url}${url.includes('?') ? '&' : '?'}pool_timeout=30`;
    }
    if (url !== rawUrl) {
      return new PrismaClient({ datasources: { db: { url } } });
    }
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
