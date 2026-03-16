import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import type { PrismaClient } from '@prisma/client';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set in environment and at least 32 characters'
    );
  }
  return secret;
}

export interface GraphQLContextParams {
  request: Request;
}

export interface GraphQLContext {
  userId: string | null;
  role: string | null;
  prisma: PrismaClient;
  request: Request;
}

/**
 * Build GraphQL context from request. Extracts userId and role from Authorization: Bearer <token>.
 */
export function buildContext({ request }: GraphQLContextParams): GraphQLContext {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let userId: string | null = null;
  let role: string | null = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as {
        sub?: string;
        userId?: string;
        role?: string;
      };
      userId = decoded.sub ?? decoded.userId ?? null;
      role = decoded.role ?? 'user';
    } catch {
      // Invalid or expired token
    }
  }

  return { userId, role, prisma, request };
}
