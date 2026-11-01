import { PrismaClient } from '@prisma/client';
import { prismaPoolUrl } from './prismaUrl.js';

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

export const prisma = globalForPrisma.prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
