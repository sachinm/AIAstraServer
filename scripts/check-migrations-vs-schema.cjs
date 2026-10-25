/**
 * Offline check that the hand-written reading-engine migrations (M1-M4) create the same tables, columns and indexes that
 * Prisma derives from schema.prisma. Input: the SQL from
 *   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > <file>
 * Usage: node scripts/check-migrations-vs-schema.cjs <generated.sql> [out.txt]
 */
const fs = require('fs');
const path = require('path');

const generated = fs.readFileSync(process.argv[2], 'utf8');
const migDir = path.join('prisma', 'migrations');
const mine = fs
  .readdirSync(migDir)
  .filter((d) => /reading_m\d/.test(d))
  .sort()
  .map((d) => fs.readFileSync(path.join(migDir, d, 'migration.sql'), 'utf8'))
  .join('\n');

function tableCols(sql, table) {
  const m = new RegExp('CREATE TABLE "' + table + '" \\(([\\s\\S]*?)\\n\\);', 'm').exec(sql);
  if (!m) return null;
  return m[1]
    .split('\n')
    .map((l) => l.trim().replace(/,$/, ''))
    .filter((l) => l.startsWith('"'))
    .map((l) => {
      const mm = /^"([^"]+)"\s+(.+)$/.exec(l);
      return { name: mm[1], def: mm[2].replace(/\s+/g, ' ') };
    });
}
function addedCols(sql, table) {
  const out = [];
  const re = new RegExp('ALTER TABLE "' + table + '"([\\s\\S]*?);', 'g');
  for (let m = re.exec(sql); m; m = re.exec(sql)) {
    for (const part of m[1].split(/ADD COLUMN/).slice(1)) {
      const mm = /^\s*"([^"]+)"\s+([^,]+)/.exec(part);
      if (mm) out.push({ name: mm[1], def: mm[2].trim().replace(/\s+/g, ' ') });
    }
  }
  return out;
}
const norm = (d) => d.replace(/DEFAULT \(uuid_generate_v4\(\)\)::text/, 'DEFAULT <uuid>').replace(/DEFAULT \(?uuid_generate_v4\(\)\)?::text/, 'DEFAULT <uuid>');
const indexes = (sql) => [...sql.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)" ON "([^"]+)"\(([^)]*)\)/g)].map((m) => m[1] + ' on ' + m[2] + '(' + m[3].replace(/\s+/g, ' ') + ')');
const fks = (sql, table) => [...sql.matchAll(new RegExp('CONSTRAINT "[^"]+" FOREIGN KEY \\("([^"]+)"\\) REFERENCES "([^"]+)"\\("([^"]+)"\\) ON DELETE (\\w+( \\w+)?)', 'g'))].length;

const lines = [];
let problems = 0;
const say = (s) => lines.push(s);

for (const t of ['kundli_facts', 'transit_snapshots', 'reading_runs']) {
  const g = tableCols(generated, t);
  const m = tableCols(mine, t);
  if (!g || !m) {
    say('MISSING table ' + t + ' (generated ' + !!g + ', mine ' + !!m + ')');
    problems++;
    continue;
  }
  const gm = new Map(g.map((c) => [c.name, norm(c.def)]));
  const mm = new Map(m.map((c) => [c.name, norm(c.def)]));
  const onlyG = [...gm.keys()].filter((k) => !mm.has(k));
  const onlyM = [...mm.keys()].filter((k) => !gm.has(k));
  const diffType = [...gm.keys()].filter((k) => mm.has(k) && gm.get(k).split(' ')[0] !== mm.get(k).split(' ')[0]);
  say('table ' + t + ': ' + g.length + ' columns generated, ' + m.length + ' in migration');
  if (onlyG.length) say('  only in schema: ' + onlyG.join(', '));
  if (onlyM.length) say('  only in migration: ' + onlyM.join(', '));
  if (diffType.length) say('  type differs: ' + diffType.map((k) => k + ' (' + gm.get(k) + ' vs ' + mm.get(k) + ')').join('; '));
  problems += onlyG.length + onlyM.length + diffType.length;
}

const gk = addedCols(generated, 'kundlis');
const gAll = tableCols(generated, 'kundlis');
const mAdded = addedCols(mine, 'kundlis');
const want = ['lat', 'lon', 'tz', 'place_resolved', 'facts_status'];
const gHas = want.filter((c) => gAll && gAll.some((x) => x.name === c));
const mHas = want.filter((c) => mAdded.some((x) => x.name === c));
say('kundlis new columns: schema has ' + gHas.join(',') + ' | migration adds ' + mHas.join(','));
if (gHas.length !== want.length || mHas.length !== want.length) problems++;
void gk;

const gi = new Set(indexes(generated).filter((i) => /kundli_facts|transit_snapshots|reading_runs/.test(i)));
const mi = new Set(indexes(mine));
const missingIdx = [...gi].filter((i) => ![...mi].some((x) => x.split(' on ')[0] === i.split(' on ')[0]));
const extraIdx = [...mi].filter((i) => ![...gi].some((x) => x.split(' on ')[0] === i.split(' on ')[0]));
say('indexes: schema ' + gi.size + ', migration ' + mi.size);
if (missingIdx.length) say('  missing in migration: ' + missingIdx.join(' | '));
if (extraIdx.length) say('  extra in migration: ' + extraIdx.join(' | '));
problems += missingIdx.length + extraIdx.length;

say(problems === 0 ? 'RESULT: schema.prisma and migrations M1-M4 agree' : 'RESULT: ' + problems + ' difference(s)');
const text = lines.join('\n') + '\n';
console.log(text);
if (process.argv[3]) fs.writeFileSync(process.argv[3], text);
process.exit(problems === 0 ? 0 : 1);
