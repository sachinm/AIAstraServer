/**
 * Doc 13 §3: print the KEY SHAPES (never the values) of the stored engine rows the roles pack reads, for one chart, so
 * the pack is written against the real stored shapes. Read only: one kundli lookup by id prefix, its ready `kundli_data`
 * rows, its facts dossier, its digest rows and a count of its activation rows. No write, no engine call, no model call.
 *
 *   npx tsx scripts/roles-pack-shapes.ts [--kundli <id prefix>]
 *
 * Output: JSON lines of `{ type, paths }`, where `paths` are dotted key paths with `[]` for array elements and `<k>` for
 * map keys (planet codes, house numbers, star names: collapsed so no chart data is printed). Nothing personal is printed;
 * the kundli id is not printed either.
 */
import 'dotenv/config';

const argv = process.argv.slice(2);
const arg = (name: string) => (argv.indexOf(name) >= 0 ? argv[argv.indexOf(name) + 1] : undefined);
const PREFIX = arg('--kundli') ?? 'c584c0a3';

const ROLE_TYPES = [
  'dignities', 'relations', 'benefic_malefic', 'strength.vimsopaka', 'strength.shadbala', 'avasthas', 'karaka.chara', 'arudhas',
  'argala.d1', 'yogas', 'doshas', 'dasha.applicable', 'sphutas', 'aspects',
];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const IDENT = /^[a-z][a-z0-9_]*$/;

/** a map keyed by data (planet codes, house numbers, star names) rather than by field names */
function isDataMap(o: Obj): boolean {
  const keys = Object.keys(o);
  if (!keys.length) return false;
  const dataLike = keys.filter((k) => !IDENT.test(k)).length;
  return dataLike >= Math.max(2, Math.ceil(keys.length / 2));
}

function paths(v: unknown, at: string, out: Set<string>, depth: number): void {
  if (depth > 7) return;
  if (Array.isArray(v)) {
    out.add(`${at}[]`);
    for (const x of v.slice(0, 12)) paths(x, `${at}[]`, out, depth + 1);
    return;
  }
  if (!isObj(v)) {
    out.add(`${at}:${v === null ? 'null' : typeof v}`);
    return;
  }
  if (isDataMap(v)) {
    for (const x of Object.values(v)) paths(x, `${at}.<k>`, out, depth + 1);
    return;
  }
  for (const [k, x] of Object.entries(v)) paths(x, at ? `${at}.${k}` : k, out, depth + 1);
}

const shapeOf = (v: unknown): string[] => {
  const s = new Set<string>();
  paths(v, '', s, 0);
  return [...s].sort();
};

// a plain client: the shared one (src/lib/prisma.ts, with the PII extension) did not answer within 100 s from a local
// shell on 2026-11-22. Rows are plain on staging today; a sealed value would print as `:string` where an object is
// expected, which shows here as a shape, never as a value.
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
try {
  const k = await prisma.kundli.findFirst({ where: { id: { startsWith: PREFIX } }, select: { id: true } });
  if (!k) {
    console.log(JSON.stringify({ error: 'no kundli with that id prefix' }));
  } else {
    const rows = await prisma.kundliData.findMany({
      where: { kundli_id: k.id, status: 'ready', NOT: { variant: 'current' } },
      select: { data_type: true, variant: true },
    });
    // every stored type name (names only), to see whether the optional engine fields have a type of their own yet
    console.log(JSON.stringify({ storedTypes: [...new Set(rows.map((r) => r.data_type))].sort() }));
    for (const t of ROLE_TYPES) {
      const r = await prisma.kundliData.findFirst({
        where: { kundli_id: k.id, data_type: t, variant: '', status: 'ready' },
        select: { payload: true, calc_version: true },
      });
      console.log(JSON.stringify({ type: t, stored: Boolean(r), paths: r ? shapeOf(r.payload) : [] }));
    }
    const { FACTS_VERSION } = await import('../src/reading/data/store.js');
    const f = await prisma.kundliFacts.findUnique({ where: { kundli_id_facts_version: { kundli_id: k.id, facts_version: FACTS_VERSION } }, select: { dossier: true } });
    if (f?.dossier && isObj(f.dossier)) {
      const d = f.dossier as Obj;
      for (const part of ['bodies', 'relations', 'nakshatra_profile', 'karakas', 'arudhas', 'special_lagnas', 'yogas', 'vargas', 'meta']) {
        console.log(JSON.stringify({ type: `facts.${part}`, paths: shapeOf(d[part]) }));
      }
      console.log(JSON.stringify({ type: 'facts', topKeys: Object.keys(d).sort() }));
    } else {
      console.log(JSON.stringify({ type: 'facts', stored: false }));
    }
    const digest = await prisma.kundliDigest.findMany({ where: { kundli_id: k.id }, select: { section: true, key: true, row: true }, take: 5000 });
    const bySection = new Map<string, Set<string>>();
    for (const r of digest) {
      const s = bySection.get(r.section) ?? new Set<string>();
      for (const p of shapeOf(r.row)) s.add(p);
      bySection.set(r.section, s);
    }
    for (const [section, s] of bySection) console.log(JSON.stringify({ type: `digest.${section}`, paths: [...s].sort() }));
    const act = await prisma.kundliActivation.groupBy({ by: ['system', 'level'], where: { kundli_id: k.id }, _count: { _all: true } });
    console.log(JSON.stringify({ type: 'activation', systemsLevels: act.map((a) => `${a.system}/L${a.level}:${a._count._all}`).sort() }));
  }
} finally {
  await prisma.$disconnect();
}
