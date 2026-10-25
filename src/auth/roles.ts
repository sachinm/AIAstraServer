/**
 * User roles (Sachin, 2026-10-25). Stored in `auth.role` as a single string.
 *
 *   novice                 every new registration (general public)
 *   public                 a member of the public with a settled account (above novice)
 *   student                astrology student
 *   astrologer             practising astrologer
 *   researcher             research access
 *   client_account_admin   administers one client (organisation) account and its users
 *   aiastra_admin          AI Astra staff administrator
 *
 * Values already in the database keep working through LEGACY_ROLE_MAP. `auth.role` rows and the column default are
 * not rewritten here: that is a separate, approved data migration.
 */
export const ROLE_IDS = ['novice', 'public', 'student', 'astrologer', 'researcher', 'client_account_admin', 'aiastra_admin'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const DEFAULT_SIGNUP_ROLE: RoleId = 'novice';

/** Roles that existed before this list. */
export const LEGACY_ROLE_MAP: Record<string, RoleId> = {
  user: 'novice',
  astrology_student: 'student',
  admin: 'aiastra_admin',
  superadmin: 'aiastra_admin',
  support: 'aiastra_admin',
};

export function canonicalRole(raw: string | null | undefined): RoleId {
  const r = (raw ?? '').trim().toLowerCase();
  if ((ROLE_IDS as readonly string[]).includes(r)) return r as RoleId;
  return LEGACY_ROLE_MAP[r] ?? DEFAULT_SIGNUP_ROLE;
}

export type Capability = 'discuss_health';

/**
 * Which roles may do what. `discuss_health` opens questions about illness, disease, diagnosis, accidents, injuries,
 * surgery and recovery (src/reading/policy/declined.ts). Override with READING_HEALTH_ROLES (comma-separated).
 * Death, lifespan and the other declined topics are closed for every role.
 */
export function rolesWith(cap: Capability): RoleId[] {
  if (cap === 'discuss_health') {
    const raw = process.env.READING_HEALTH_ROLES?.trim();
    const list = raw ? raw.split(',').map((x) => canonicalRole(x)) : (['astrologer', 'researcher', 'aiastra_admin'] as RoleId[]);
    return [...new Set(list)];
  }
  return [];
}

export function roleCan(raw: string | null | undefined, cap: Capability): boolean {
  return rolesWith(cap).includes(canonicalRole(raw));
}

export function isAiAstraAdmin(raw: string | null | undefined): boolean {
  return canonicalRole(raw) === 'aiastra_admin';
}
