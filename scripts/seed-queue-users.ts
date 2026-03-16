/**
 * One-off seed: creates 10 users with DOB/TOB/place and enqueues each for Kundli sync
 * (queue_status = 'pending'). Run from backend: npm run seed:queue-users
 */
import { config } from 'dotenv';
config();

import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/hash.js';
import { encrypt } from '../src/lib/encrypt.js';
import { enqueueKundliSync } from '../src/services/kundliQueueService.js';

const SEED_PASSWORD = 'SeedUser#123';

const SEED_USERS = [
  { username: 'seeduser1', date_of_birth: '1992-05-14', time_of_birth: '08:30:00', place_of_birth: 'Mumbai, IN' },
  { username: 'seeduser2', date_of_birth: '1988-11-03', time_of_birth: '14:15:00', place_of_birth: 'Delhi, IN' },
  { username: 'seeduser3', date_of_birth: '1996-12-07', time_of_birth: '10:34:00', place_of_birth: 'Chennai, IN' },
  { username: 'seeduser4', date_of_birth: '1990-07-22', time_of_birth: '06:00:00', place_of_birth: 'Kolkata, IN' },
  { username: 'seeduser5', date_of_birth: '1995-01-19', time_of_birth: '18:45:00', place_of_birth: 'Bangalore, IN' },
  { username: 'seeduser6', date_of_birth: '1987-09-30', time_of_birth: '12:00:00', place_of_birth: 'Hyderabad, IN' },
  { username: 'seeduser7', date_of_birth: '1993-04-08', time_of_birth: '21:20:00', place_of_birth: 'Pune, IN' },
  { username: 'seeduser8', date_of_birth: '1999-02-25', time_of_birth: '09:10:00', place_of_birth: 'Ahmedabad, IN' },
  { username: 'seeduser9', date_of_birth: '1991-08-11', time_of_birth: '16:55:00', place_of_birth: 'Jaipur, IN' },
  { username: 'seeduser10', date_of_birth: '1994-10-05', time_of_birth: '11:40:00', place_of_birth: 'Lucknow, IN' },
];

async function main(): Promise<void> {
  const hashedPassword = await hashPassword(SEED_PASSWORD);

  for (const u of SEED_USERS) {
    const existing = await prisma.auth.findFirst({
      where: { username: u.username },
      select: { id: true },
    });
    if (existing) {
      await enqueueKundliSync(prisma, existing.id);
      console.log(`Enqueued existing user: ${u.username}`);
      continue;
    }

    const dateOfBirthEnc = encrypt(u.date_of_birth) ?? u.date_of_birth;
    const placeOfBirthEnc = encrypt(u.place_of_birth) ?? u.place_of_birth;
    const timeOfBirthEnc = encrypt(u.time_of_birth) ?? u.time_of_birth;

    const created = await prisma.auth.create({
      data: {
        username: u.username,
        email: `${u.username}@example.com`,
        password: hashedPassword,
        date_of_birth: dateOfBirthEnc,
        place_of_birth: placeOfBirthEnc,
        time_of_birth: timeOfBirthEnc,
        role: 'user',
        is_active: true,
        kundli_added: false,
      },
    });
    await enqueueKundliSync(prisma, created.id);
    console.log(`Created and enqueued: ${u.username} (${created.id})`);
  }

  console.log('Seed done. Pending Kundli rows will be picked up by the queue worker.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
