/**
 * TODOS (cards): `readCardReadings` read only the 300 newest rows and the board's display read `take: ids×4`, so a card
 * whose rows were older than other cards' newer rows showed blank or old. Now the newest rows per card are picked in SQL
 * (plain key columns only) and their sealed outputs read through the Prisma client by cache_key. The fake runs the same
 * selection in memory: partition by the key's card field, newest first, two per card, on the asked clock.
 */
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { lensValidity } from '../../../../src/reading/boards/lensValidity.js';
import { cardStoreKey, newestCardRows, readCardReadings } from '../../../../src/reading/cards/store.js';

type Row = { cache_key: string; kundli_id: string; technique_id: string; digest_version: string; created_at: Date; valid_to: Date | null; output: unknown };

const key = (card: string, clock: string, n: number) =>
  cardStoreKey({ card: card as never, clock, frameHash: `f${n}`, ledgerHash: 'l', prefixHash: 'p', profileHash: 'pr', portraitHash: 'po', sectionsHash: 's', confirmHash: 'c', promptHash: 'h' });

function fake(rows: Row[]) {
  const sql: string[] = [];
  const findManyArgs: unknown[] = [];
  const prisma = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      sql.push(strings.join('?'));
      const [kundliId, technique, clockField, cards, perCard] = [values[0], values[1], values[2], values[3] as string[] | null, values[5] as number];
      const field = (v: string, i: number) => v.split('|')[i - 1] ?? '';
      const hit = rows
        .filter((r) => r.kundli_id === kundliId && r.technique_id === technique && field(r.digest_version, 1) === 'self.card' && field(r.digest_version, 3) === clockField)
        .filter((r) => cards === null || cards.includes(field(r.digest_version, 2)))
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      const seen = new Map<string, number>();
      return hit
        .filter((r) => {
          const c = field(r.digest_version, 2);
          seen.set(c, (seen.get(c) ?? 0) + 1);
          return seen.get(c)! <= perCard;
        })
        .map((r) => ({ cache_key: r.cache_key }));
    },
    techniqueOutput: {
      findMany: async (q: { where: { cache_key: { in: string[] } } }) => {
        findManyArgs.push(q);
        return rows.filter((r) => q.where.cache_key.in.includes(r.cache_key)).sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, sql, findManyArgs };
}

let n = 0;
const at = (day: number) => new Date(Date.UTC(2026, 10, day, 0, 0, n++ % 60));
function row(card: string, day: number, clock = 'vimsottari', content: unknown = { line: `${card}@${day}`, spans: [] }): Row {
  const i = n++;
  return { cache_key: `ck${i}`, kundli_id: 'k1', technique_id: 'self.card.reading', digest_version: key(card, clock, i), created_at: at(day), valid_to: null, output: { card, content } };
}

describe('newest row per card', () => {
  // `dating_pulse` was read on the 1st; 400 newer rows of other cards were written after it (the old 300-row window
  // and the ids×4 window both lost it)
  const rows: Row[] = [row('dating_pulse', 1), row('dating_pulse', 2), ...Array.from({ length: 400 }, (_, i) => row(i % 2 ? 'body' : 'job_pulse', 3 + (i % 10)))];

  it('every asked card gets its newest reading, whatever the other cards hold', async () => {
    const f = fake(rows);
    const out = await readCardReadings(f.prisma, 'k1', 'vimsottari', ['dating_pulse', 'job_pulse']);
    expect(out.dating_pulse).toMatchObject({ line: 'dating_pulse@2' });
    expect(out.job_pulse).toBeTruthy();
    expect(Object.keys(out).sort()).toEqual(['dating_pulse', 'job_pulse']);
    // without ids: every card on the clock (the You board's read)
    expect(Object.keys(await readCardReadings(f.prisma, 'k1', 'vimsottari')).sort()).toEqual(['body', 'dating_pulse', 'job_pulse']);
  });

  it('at most two rows per card reach the sealed read, fetched by cache_key; another clock is not read', async () => {
    const f = fake([...rows, row('dating_pulse', 20, 'yogini')]);
    const got = await newestCardRows(f.prisma, 'k1', 'vimsottari', ['dating_pulse', 'body']);
    expect(got).toHaveLength(4);
    expect(got.every((r) => (r.digest_version ?? '').includes('|clock=vimsottari|'))).toBe(true);
    expect(f.findManyArgs).toHaveLength(1);
    // the selection is on exact key fields (split_part), never LIKE (an `_` in a card id is a LIKE wildcard)
    expect(f.sql[0]).toMatch(/split_part\("digest_version", '\|', 2\)/);
    expect(f.sql[0]).not.toMatch(/LIKE/i);
  });

  it('a newest row with no content falls back to the card\'s previous reading', async () => {
    const f = fake([row('body', 1), row('body', 5, 'vimsottari', null)]);
    expect((await readCardReadings(f.prisma, 'k1', 'vimsottari', ['body'])).body).toMatchObject({ line: 'body@1' });
  });

  it('no ids asked: nothing read; no rows: empty', async () => {
    const f = fake(rows);
    expect(await readCardReadings(f.prisma, 'k1', 'vimsottari', [])).toEqual({});
    expect(f.sql).toHaveLength(0);
    expect(await readCardReadings(fake([]).prisma, 'k1', 'vimsottari', ['body'])).toEqual({});
  });

  it("the lens's dates come from the same newest rows, so a crowded-out card still counts", async () => {
    const f = fake(rows);
    const view = await lensValidity(f.prisma, 'k1', 'vimsottari', ['dating_pulse', 'job_pulse'], '2026-11-20');
    // madeAt is the oldest of the deck's newest readings: dating_pulse's, on the 2nd
    expect(view.madeAt?.slice(0, 10)).toBe('2026-11-02');
  });
});
