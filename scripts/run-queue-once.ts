import { config } from 'dotenv';
config();
import { prisma } from '../src/lib/prisma.js';
import { processKundliSyncQueue } from '../src/services/kundliQueueService.js';

async function main() {
  console.log('Running queue once...');
  await processKundliSyncQueue(prisma);
  console.log('Done.');
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
