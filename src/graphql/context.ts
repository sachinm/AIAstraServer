import { prisma } from '../lib/prisma.js';
import type { PrismaClient } from '@prisma/client';
import { authenticateRequest, type RequestAuthDeps } from '../auth/requestAuth.js';

export { getJwtSecret } from '../auth/jwtSecret.js';

export interface GraphQLContextParams {
  request: Request;
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
  prisma: PrismaClient;
  request: Request;
}

/**
 * Build GraphQL context from request through authenticateRequest (src/auth/requestAuth.ts): the JWT from
 * X-Astra-Authorization (CloudFront OAC owns Authorization toward the Lambda Function URL), else Authorization,
 * checked against the auth row (role, lock, token version). Yoga accepts a context factory that returns a Promise.
 */
export async function buildContext({ request }: GraphQLContextParams, deps: RequestAuthDeps = {}): Promise<GraphQLContext> {
  const auth = await authenticateRequest(request.headers, deps);
  return { userId: auth.userId, role: auth.role, locked: auth.locked, prisma, request };
}
