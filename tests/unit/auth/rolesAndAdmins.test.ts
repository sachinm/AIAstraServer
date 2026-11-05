/** Roles (docs/admin/01 §4.1.3): one admin role, one exempt list, both by canonical role; admins bootstrapped from env. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { ADMIN_ROLES, QUOTA_EXEMPT_ROLES, isAdminRole, isQuotaExempt } from '../../../src/auth/roles.js';
import { EXEMPT_ROLES } from '../../../src/billing/plans.js';
import { adminEmailsFrom, ensureAdmins } from '../../../src/ensureAdmins.js';

afterEach(() => vi.restoreAllMocks());

describe('roles', () => {
  it('only aiastra_admin is an admin; legacy admin, superadmin and support map to it', () => {
    expect(ADMIN_ROLES).toEqual(['aiastra_admin']);
    for (const r of ['aiastra_admin', 'admin', 'superadmin', 'support', ' Superadmin ']) expect(isAdminRole(r)).toBe(true);
    for (const r of ['novice', 'user', 'astrologer', 'researcher', 'client_account_admin', '', null, undefined]) expect(isAdminRole(r)).toBe(false);
  });

  it('aiastra_admin, astrologer and researcher are quota exempt; client_account_admin is not', () => {
    expect([...QUOTA_EXEMPT_ROLES].sort()).toEqual(['aiastra_admin', 'astrologer', 'researcher']);
    expect(EXEMPT_ROLES).toBe(QUOTA_EXEMPT_ROLES);
    for (const r of ['aiastra_admin', 'support', 'admin', 'superadmin', 'astrologer', 'researcher']) expect(isQuotaExempt(r)).toBe(true);
    for (const r of ['novice', 'user', 'student', 'public', 'client_account_admin', null]) expect(isQuotaExempt(r)).toBe(false);
  });
});

function authDb(rows: Array<{ id: string; email: string; role: string | null }>) {
  const update = vi.fn(async ({ where, data }: { where: { id: string }; data: { role: string } }) => {
    const row = rows.find((r) => r.id === where.id)!;
    row.role = data.role;
    return row;
  });
  const findMany = vi.fn(async ({ where }: { where: { email: { equals: string } } }) => rows.filter((r) => r.email.toLowerCase() === where.email.equals.toLowerCase()).map(({ id, role }) => ({ id, role })));
  const create = vi.fn();
  return { db: { auth: { findMany, update, create } } as unknown as Pick<PrismaClient, 'auth'>, update, findMany, create };
}

describe('ensureAdmins', () => {
  it('reads a comma list, case-insensitive, ignoring blanks', () => {
    expect(adminEmailsFrom({ ADMIN_EMAILS: ' A@x.com, ,b@Y.com,a@X.com ,nope' } as NodeJS.ProcessEnv)).toEqual(['a@x.com', 'b@y.com']);
    expect(adminEmailsFrom({} as NodeJS.ProcessEnv)).toEqual([]);
  });

  it('promotes an existing row, leaves an admin alone, and never creates a row or touches a password', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const rows = [
      { id: 'u1', email: 'Sachin@Example.com', role: 'novice' },
      { id: 'u2', email: 'ops@example.com', role: 'superadmin' },
    ];
    const t = authDb(rows);
    const n = await ensureAdmins(t.db, { ADMIN_EMAILS: 'sachin@example.com,ops@example.com,nobody@example.com' } as NodeJS.ProcessEnv);
    expect(n).toBe(1);
    expect(rows[0]!.role).toBe('aiastra_admin');
    expect(rows[1]!.role).toBe('superadmin'); // already admin through the legacy map
    expect(t.update).toHaveBeenCalledTimes(1);
    expect(t.update.mock.calls[0]![0]).toEqual({ where: { id: 'u1' }, data: { role: 'aiastra_admin' } });
    expect(t.create).not.toHaveBeenCalled();
  });

  it('does nothing without ADMIN_EMAILS and never throws on a database error', async () => {
    const t = authDb([]);
    expect(await ensureAdmins(t.db, {} as NodeJS.ProcessEnv)).toBe(0);
    expect(t.findMany).not.toHaveBeenCalled();
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    t.findMany.mockRejectedValueOnce(Object.assign(new Error('down for sachin@example.com'), { code: 'P1001' }));
    await expect(ensureAdmins(t.db, { ADMIN_EMAILS: 'sachin@example.com' } as NodeJS.ProcessEnv)).resolves.toBe(0);
    expect(String(err.mock.calls[0]![0])).not.toContain('sachin');
  });
});
