import { PrismaClient } from '@prisma/client';
import { prismaPoolUrl } from './prismaUrl.js';
import { piiExtension } from './pii/prismaExtension.js';
import { readPiiConfig } from './pii/keys.js';

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

function buildPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;
  if (rawUrl) {
    const url = prismaPoolUrl(rawUrl);
    if (url !== rawUrl) {
      return new PrismaClient({ datasources: { db: { url } } });
    }
  }
  return new PrismaClient();
}

/**
 * Every query passes through the PII extension (docs/privacy/02 §4.1.4): sealed values are opened on read, sealed on
 * write when PII_WRITE_MODE=sealed, and a filter on a sealed column throws. The extension is query-only and changes no
 * result type, so the client keeps the PrismaClient type every caller already takes.
 */
function buildClient(): PrismaClient {
  readPiiConfig(); // refuse to start on a bad PII configuration (e.g. the local key provider on a Lambda)
  return buildPrismaClient().$extends(piiExtension) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
