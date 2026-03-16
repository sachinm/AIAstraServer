import type { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/hash.js';

const MANAGED_ROLES = ['astrology_student', 'astrologer'] as const;

function isManagedRole(role: string | null): role is (typeof MANAGED_ROLES)[number] {
  return role === 'astrology_student' || role === 'astrologer';
}

/**
 * List users for User Management Dashboard. Only astrology_student and astrologer.
 */
export async function listUsers(
  prisma: PrismaClient,
  role?: string | null,
  search?: string | null
): Promise<{ id: string; username: string; email: string; role: string | null; is_active: boolean | null; kundli_added: boolean | null; created_at: Date }[]> {
  const roleFilter = role && isManagedRole(role) ? [role] : [...MANAGED_ROLES];
  const where: Prisma.AuthWhereInput = {
    role: { in: roleFilter },
  };
  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { username: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ];
  }
  const rows = await prisma.auth.findMany({
    where,
    select: { id: true, username: true, email: true, role: true, is_active: true, kundli_added: true, created_at: true },
    orderBy: { created_at: 'desc' },
  });
  return rows;
}

/**
 * Get user by id for User Detail. Returns null if user is not astrology_student or astrologer.
 */
export async function getUserById(
  prisma: PrismaClient,
  id: string
): Promise<{
  id: string;
  username: string;
  email: string;
  role: string | null;
  date_of_birth: string;
  place_of_birth: string | null;
  time_of_birth: string | null;
  gender: string | null;
  is_active: boolean | null;
  kundli_added: boolean | null;
  created_at: Date;
} | null> {
  const user = await prisma.auth.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      date_of_birth: true,
      place_of_birth: true,
      time_of_birth: true,
      gender: true,
      is_active: true,
      kundli_added: true,
      created_at: true,
    },
  });
  if (!user || !isManagedRole(user.role)) return null;
  return user;
}

export interface AdminUpdateUserInput {
  username?: string;
  email?: string;
  date_of_birth?: string;
  place_of_birth?: string | null;
  time_of_birth?: string | null;
  gender?: string | null;
  is_active?: boolean;
}

/**
 * Update user profile. Rejects if target is not astrology_student or astrologer.
 */
export async function updateUser(
  prisma: PrismaClient,
  id: string,
  input: AdminUpdateUserInput
): Promise<{ success: false; error: string } | { success: true }> {
  const existing = await prisma.auth.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!existing || !isManagedRole(existing.role)) {
    return { success: false, error: 'User not found or cannot be updated' };
  }
  await prisma.auth.update({
    where: { id },
    data: {
      ...(input.username != null && { username: input.username }),
      ...(input.email != null && { email: input.email }),
      ...(input.date_of_birth != null && { date_of_birth: input.date_of_birth }),
      ...(input.place_of_birth !== undefined && { place_of_birth: input.place_of_birth }),
      ...(input.time_of_birth !== undefined && { time_of_birth: input.time_of_birth }),
      ...(input.gender !== undefined && { gender: input.gender }),
      ...(input.is_active != null && { is_active: input.is_active }),
    },
  });
  return { success: true };
}

const MIN_PASSWORD_LENGTH = 6;

/**
 * Reset user password. Rejects if target is not astrology_student or astrologer.
 */
export async function resetPassword(
  prisma: PrismaClient,
  id: string,
  newPassword: string
): Promise<{ success: false; error: string } | { success: true }> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  const existing = await prisma.auth.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!existing || !isManagedRole(existing.role)) {
    return { success: false, error: 'User not found or cannot be updated' };
  }
  const hashed = await hashPassword(newPassword);
  await prisma.auth.update({
    where: { id },
    data: { password: hashed },
  });
  return { success: true };
}
