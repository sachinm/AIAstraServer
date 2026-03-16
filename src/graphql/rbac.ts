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
] as const;

export type AllowedRole = (typeof ALL_AUTHENTICATED_ROLES)[number];

export interface GraphQLContext {
  userId: string | null;
  role: string | null;
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
