/**
 * S10 `self.sub.profile` (docs/reading-engine/66 §4.2, §4.8): the person profile pack, read through `loadProfilePack`
 * (auth and person_facts; age is calendar arithmetic over the typed birth date). Nothing astrological.
 */
import type { PrismaClient } from '@prisma/client';
import { loadProfilePack } from '../../person/profile.js';
import type { ProfilePack } from '../v2types.js';

export function subProfile(prisma: PrismaClient, userId: string, asOf: string): Promise<ProfilePack> {
  return loadProfilePack(prisma, userId, asOf);
}
