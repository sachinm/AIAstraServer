/**
 * One-off diagnostic: fetch Kundli for a user and log whether narayana_dasa (and all fields)
 * are present on the row and in kundliUserContents. Run with:
 *   npx tsx scripts/debug-kundli-user-contents.ts [user_id]
 * Default user_id: f6213a07-91f4-4611-abec-00af97a4f2f5
 */
import { config } from 'dotenv';
config();
import { prisma } from '../src/lib/prisma.js';
import { fetchLatestKundliForUser } from '../kundli-rag.js';
import { buildUserMessageWithKundli, KUNDLI_FIELD_TITLES } from '../src/services/groqChatService.js';

const USER_ID = process.argv[2] ?? 'f6213a07-91f4-4611-abec-00af97a4f2f5';

async function main() {
  console.log('User ID:', USER_ID);
  const row = await fetchLatestKundliForUser(prisma, USER_ID);
  console.log('\nRow keys:', Object.keys(row));
  console.log('narayana_dasa on row:', 'narayana_dasa' in row ? 'present' : 'MISSING');
  console.log('narayana_dasa value type:', typeof (row as Record<string, unknown>).narayana_dasa);
  console.log('narayana_dasa is null?', (row as Record<string, unknown>).narayana_dasa === null);
  console.log('narayana_dasa is undefined?', (row as Record<string, unknown>).narayana_dasa === undefined);

  const { kundliUserContents } = buildUserMessageWithKundli(
    {
      biodata: row.biodata,
      d1: row.d1,
      d7: row.d7,
      d9: row.d9,
      d10: row.d10,
      charakaraka: row.charakaraka,
      vimsottari_dasa: row.vimsottari_dasa,
      narayana_dasa: row.narayana_dasa,
    },
    'Test question'
  );

  console.log('\nkundliUserContents length:', kundliUserContents.length);
  const expectedTitles = Object.values(KUNDLI_FIELD_TITLES);
  for (let i = 0; i < expectedTitles.length; i++) {
    const title = expectedTitles[i];
    const found = kundliUserContents.some((c) => c.includes(`This is the ${title} of the person:`));
    console.log(`  [${i + 1}] ${title}: ${found ? 'YES' : 'MISSING'}`);
  }
  const hasNarayana = kundliUserContents.some((c) => c.includes('Narayana Dasa'));
  console.log('\nNarayana Dasa in kundliUserContents:', hasNarayana ? 'YES' : 'MISSING');
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
