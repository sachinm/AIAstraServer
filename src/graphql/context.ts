import { prisma } from '../lib/prisma.js';
import type { PrismaClient } from '@prisma/client';
import type express from 'express';
import { authenticateRequest, type RequestAuthDeps } from '../auth/requestAuth.js';

export { getJwtSecret } from '../auth/jwtSecret.js';

export interface GraphQLContextParams {
  request: Request;
  req?: express.Request;
  res?: express.Response;
}

export interface GraphQLContext {
  userId: string | null;
  /** canonical role from the auth row (src/auth/roles.ts), not from the token */
  role: string | null;
  /**
   * The auth row is locked. Only `me` and `logout` run; every other operation is refused by lockGuardPlugin
   * (src/graphql/lockGuard.ts) before any resolver starts.
   */
  locked?: boolean;
  /** Set when authenticateRequest failed closed due to an auth DB failure (`503 AUTH_UNAVAILABLE`). */
  authUnavailable?: boolean;
  requestId?: string | null;
  prisma: PrismaClient;
  request: Request;
  req?: express.Request;
  res?: express.Response;
  cookiesToSet?: string[];
}

/**
 * Build GraphQL context from request through authenticateRequest (src/auth/requestAuth.ts): the JWT from
 * X-Astra-Authorization (CloudFront OAC owns Authorization toward the Lambda Function URL), else Authorization,
 * checked against the auth row (role, lock, token version). Yoga accepts a context factory that returns a Promise.
 */
export async function buildContext(params: GraphQLContextParams, deps: RequestAuthDeps = {}): Promise<GraphQLContext> {
  const { request, req, res } = params;
  const auth = await authenticateRequest(req?.headers ?? request.headers, deps);
  const requestId = (req?.headers['x-request-id'] as string | undefined) ?? request.headers.get('x-request-id') ?? null;
  return {
    userId: auth.userId,
    role: auth.role,
    locked: auth.locked,
    authUnavailable: auth.reason === 'auth_unavailable',
    requestId,
    prisma,
    request,
    req,
    res,
    cookiesToSet: [],
  };
}
