/**
 * Prints the estimated token size of each evidence-pack section for three subjects on the golden chart, next to the whole
 * dossier. `--dump <dir>` also writes the career pack (compact JSON) and the cacheable base prefix there.
 *
 *   npx tsx scripts/pack-size.ts [--dump docs/screenshots/p1-02-pack-sizes]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildEvidencePack, renderBase, renderPack } from '../src/reading/packs/selector.js';
import { loadG1Dossier, loadG1Transits, G1_AS_OF } from '../tests/helpers/readingFixtures.js';

const d = loadG1Dossier();
const t = loadG1Transits();
const est = (s: string) => Math.ceil(s.length / 3.6);
for (const [s, h] of [['career_work', '1y'], ['property_home', '3y'], ['general_life_direction', 'life']] as const) {
  const p = buildEvidencePack({ dossier: d, transits: t, subject: s, asOf: G1_AS_OF, intent: { horizon: h, mentionsPlanets: [], focusPoints: [] } });
  const secs = Object.fromEntries(Object.entries(p.sections).map(([k, v]) => [k, est(JSON.stringify(v))]));
  console.log(s, h, '~tokens', p.stats.approxTokens, JSON.stringify(secs));
}
console.log('whole dossier ~tokens', est(JSON.stringify(d)), '(what a cache of the full dossier would hold)');

const i = process.argv.indexOf('--dump');
if (i >= 0) {
  const dir = process.argv[i + 1] ?? 'pack-dump';
  mkdirSync(dir, { recursive: true });
  const p = buildEvidencePack({ dossier: d, transits: t, subject: 'career_work', asOf: G1_AS_OF, intent: { horizon: '1y', mentionsPlanets: [], focusPoints: [] } });
  writeFileSync(path.join(dir, '02-career-pack-1y.json'), JSON.stringify(JSON.parse(renderPack(p)), null, 1));
  writeFileSync(path.join(dir, '03-base-prefix.json'), JSON.stringify(JSON.parse(renderBase(p)), null, 1));
  console.log('dumped to', dir);
}
