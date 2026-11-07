/**
 * RBAC helpers for GraphQL resolvers.
 * Use requireAuth for "any authenticated user"; use requireRoles for explicit role allowlist.
 */

export const ALL_AUTHENTICATED_ROLES = [
  'user',
  'astrology_student',
  'astrologer',
  'support',
  'admin',
  'superadmin',
  // roles from src/auth/roles.ts (2026-10-25)
  'novice',
  'public',
  'student',
  'researcher',
  'client_account_admin',
  'aiastra_admin',
] as const;

export type AllowedRole = (typeof ALL_AUTHENTICATED_ROLES)[number];

export interface GraphQLContext {
  userId: string | null;
  role: string | null;
  locked?: boolean;
  prisma: import('@prisma/client').PrismaClient;
  request: Request;
}

/**
 * Throws if context has no userId (not authenticated). Use for operations that require login.
 */
export function requireAuth(context: GraphQLContext): asserts context is GraphQLContext & { userId: string } {
  if (!context.userId) {
    throw new Error('Not authenticated');
  }
}

/**
 * Throws if context has no userId or role is not in the allowed list.
 * Use for operations that require specific roles (e.g. ALL_AUTHENTICATED_ROLES for current API).
 */
export function requireRoles(
  context: GraphQLContext,
  allowedRoles: readonly string[]
): asserts context is GraphQLContext & { userId: string; role: string } {
  if (!context.userId) {
    throw new Error('Not authenticated');
  }
  const role = context.role ?? 'user';
  if (!allowedRoles.includes(role)) {
    throw new Error('Forbidden');
  }
}

/**
 * Enforces strict account-ownership isolation: if a request or resolver supplies a target userId
 * that does not match the authenticated user's id, throws `Forbidden: cross-account access denied`.
 */
export function assertOwnAccount(
  authenticatedUserId: string | null | undefined,
  targetUserId?: string | null
): asserts authenticatedUserId is string {
  if (!authenticatedUserId) {
    throw new Error('Not authenticated');
  }
  if (targetUserId != null && targetUserId.trim() !== '' && targetUserId.trim() !== authenticatedUserId) {
    throw new Error('Forbidden: cross-account access denied');
  }
}

