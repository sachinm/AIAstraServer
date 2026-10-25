import { buildEvidencePack } from '../src/reading/packs/selector.js';
import { loadG1Dossier, loadG1Transits, G1_AS_OF } from '../tests/helpers/readingFixtures.js';

const d = loadG1Dossier();
const t = loadG1Transits();
for (const [s, h] of [['career_work', '1y'], ['property_home', '3y'], ['general_life_direction', 'life']] as const) {
  const p = buildEvidencePack({ dossier: d, transits: t, subject: s, asOf: G1_AS_OF, intent: { horizon: h, mentionsPlanets: [], focusPoints: [] } });
  const secs = Object.fromEntries(Object.entries(p.sections).map(([k, v]) => [k, Math.ceil(JSON.stringify(v).length / 3.6)]));
  console.log(s, h, '~tokens', p.stats.approxTokens, JSON.stringify(secs));
}
console.log('full dossier ~tokens', Math.ceil(JSON.stringify(d).length / 3.6));
