/**
 * Layer 2 of the Self v2 build (docs/reading-engine/66 §4.8): one `AreaBrief` per `SELF_V2_AREAS` entry, in that order,
 * each a pure selection over `ctx.sub`. No area reads the database or the digest.
 */
import { SELF_V2_AREAS, type AreaBrief, type SelfBuildContext, type SelfV2AreaId } from '../v2types.js';
import { nowArea } from './now.js';
import { stuckArea } from './stuck.js';
import { chapterArea } from './chapter.js';
import { diagnosisArea } from './diagnosis.js';
import { lagnaArea } from './lagna.js';
import { mindArea } from './mind.js';
import { bodyArea } from './body.js';
import { driveArea } from './drive.js';
import { presenceArea } from './presence.js';
import { yogasArea } from './yogas.js';
import { chaptersArea } from './chapters.js';
import { yearArea } from './year.js';

const SELECTORS: Record<SelfV2AreaId, (ctx: SelfBuildContext) => AreaBrief> = {
  now: nowArea,
  stuck: stuckArea,
  chapter: chapterArea,
  diagnosis: diagnosisArea,
  lagna: lagnaArea,
  mind: mindArea,
  body: bodyArea,
  drive: driveArea,
  presence: presenceArea,
  yogas: yogasArea,
  chapters: chaptersArea,
  year: yearArea,
};

export function buildAreaBriefs(ctx: SelfBuildContext): AreaBrief[] {
  return SELF_V2_AREAS.map((a) => SELECTORS[a.id](ctx));
}
