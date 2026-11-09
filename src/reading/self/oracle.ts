/**
 * The model layer of the You reading (technique `self.reading.oracle`, agent `self.reading_oracle`,
 * docs/reading-engine/58 §4.1 & docs/reading-engine/63 §5).
 *
 * Architecture (Doc 63):
 *   1. Five Chart-Family Sub-Agents (`family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`)
 *      read deterministic digest/activation slices (`parts[0]` = immutable/windowed chart pack for Gemini `cachedContents`,
 *      `parts[1]` = dynamic horizon/focus suffix) and store reusable findings in `reading_findings_cache`.
 *   2. The Self Lineman AI Agent (`lineman.self`, prompt `readers/R15-self`) compiles the 5 family findings + panel claims
 *      into a cross-checked brief (promise vs varga/avastha modifiers, active Mahadasha/Antardasha 9x9 fruition & delays,
 *      annual TP/VP confirmation, and transit/SAV triggers).
 *   3. The Self Oracle Synthesizer (`self.reading_oracle`, prompt `oracle/self`) writes the final second-person narrative,
 *      validated by `validateSelfText` against the allowed evidence keys and stored in `technique_outputs`.
 *   4. Enforces the cumulative $1.00 spend cap (`getSelfReadingMaxSpendUsd()`).
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { withAgentRun, type ChartUsed } from '../../agents/registry.js';
import { getSelfOracleMaxOutputTokens, getSelfReadingMaxSpendUsd, isSelfOracleAreasEnabled, isSelfReadingModelEnabled } from '../../config/env.js';
import { withTechniqueOutput } from '../../techniques/outputStore.js';
import type { DateSpan } from '../../techniques/pieces.js';
import type { TransitRangePayload } from '../chartData/transitRange.js';
import type { ActivationRow } from '../digest/activation.js';
import type { DigestView } from '../digest/types.js';
import { callGemini, type GeminiResult } from '../llm/gemini.js';
import { modelFor, usageCostUsd } from '../llm/models.js';
import { loadDbReaderCache, saveDbReaderCache, type HeldReader } from '../oracle/prewarm.js';
import { PROMPTS, PROMPT_VERSION } from '../prompts/generated.js';
import { runningMudda, runningTp } from './panels/year.js';
import { allRunningDashas, mdSpine, runningChain } from './slices.js';
import { clockLabel, MAX_LINE_WORDS, redactEngineTerms, wordCount } from './words.js';
import { areaCertaintyToLine, areaDocToText, oracleAreaSchema, parseAreaDoc, validateAreaDoc } from './areaDoc.js';
import { ensurePromptCache } from '../llm/promptCache.js';
import { LOVE_PANEL_IDS, SELF_PANEL_IDS, WORK_PANEL_IDS } from './types.js';
import type {
  BoardPanelId,
  ConfirmAnswer,
  LineCertainty,
  LineRange,
  PanelPlan,
  ReadingBoardId,
  SelfClock,
  SelfOracleLinemanRecord,
  SelfOraclePayload,
  SelfOracleStageSummary,
  SelfPanelId,
  SelfReading,
} from './types.js';

export type SelfOracleResult = SelfOraclePayload;

export type SelfFamilyAgentId = 'family.rasi' | 'family.varga' | 'family.dasha' | 'family.year' | 'family.sky';

export const SELF_FAMILY_AGENT_IDS: readonly SelfFamilyAgentId[] = [
  'family.rasi',
  'family.varga',
  'family.dasha',
  'family.year',
  'family.sky',
];

/** Maps each panel (or 'all') to the reusable chart-family sub-agents it needs (Doc 63 & reusable sub-technique plan). */
export const FAMILY_AGENTS_BY_SCOPE: Record<BoardPanelId | 'all', readonly SelfFamilyAgentId[]> = {
  all: SELF_FAMILY_AGENT_IDS,
  diagnosis: SELF_FAMILY_AGENT_IDS,
  body: SELF_FAMILY_AGENT_IDS,
  struggle: SELF_FAMILY_AGENT_IDS,
  chapters: ['family.rasi', 'family.varga', 'family.dasha'],
  year: ['family.rasi', 'family.year'],
  lagna: ['family.rasi', 'family.varga'],
  mind: ['family.rasi', 'family.varga'],
  atma: ['family.rasi', 'family.varga'],
  yogas: ['family.rasi', 'family.varga'],
  heart: ['family.rasi', 'family.varga'],
  partner: ['family.rasi', 'family.varga'],
  bond: ['family.rasi', 'family.varga'],
  circle: ['family.rasi', 'family.varga'],
  vocation: ['family.rasi', 'family.varga'],
  standing: ['family.rasi', 'family.varga'],
  ground: ['family.rasi', 'family.varga'],
  gain: ['family.rasi', 'family.varga'],
};

export interface SelfFamilyPack {
  id: SelfFamilyAgentId;
  natal: boolean;
  horizonKey: string;
  /** Expiry timestamp for this reusable sub-technique in `reading_findings_cache`. */
  expiresAt?: Date;
  /** Stable chart pack placed in `parts[0]` for Gemini `cachedContents` prefix caching (no TODAY date in natal packs). */
  prefix: string;
  /** Dynamic question/horizon suffix placed in `parts[1]`. */
  dynamic: string;
  packHash: string;
  keys: string[];
  charts: ChartUsed[];
}

export interface SelfOracleContext {
  prisma: PrismaClient;
  board?: ReadingBoardId;
  userId: string;
  kundliId: string;
  view: DigestView;
  activation: readonly ActivationRow[];
  sky?: TransitRangePayload | null;
  now?: Date;
  force?: boolean;
  only?: BoardPanelId;
  codeVersion?: string;
  runningSpan?: DateSpan | null;
  /**
   * `cached_only` (the page request): serve a stored synthesis that covers today, otherwise answer `{ status: 'pending' }`
   * without a model call and without storing anything; the background build (`buildEvent.ts`) runs the default `build`.
   */
  mode?: 'build' | 'cached_only';
  /** docs/reading-engine/65: stored boundaries and windows the area validator checks dates against */
  boundaries?: ReadonlySet<string>;
  windows?: ReadonlyArray<{ from: string; to: string }>;
  /** the board's panel titles and order, for the area document's text form */
  panelTitles?: Partial<Record<BoardPanelId, string>>;
  panelOrder?: readonly BoardPanelId[];
}

/** Gemini time-outs for the stages that run in the background build (never inside a page request). */
export const LINEMAN_TIMEOUT_MS = 90_000;
export const ORACLE_TIMEOUT_MS = 150_000;

export { redactEngineTerms };

const shortHash = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 24);

/**
 * Builds the 5 deterministic chart-family packs (`family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`)
 * from `DigestView` + `kundli_activation` + optional `sky` overlay.
 */
export function buildSelfFamilyPacks(
  view: DigestView,
  activation: readonly ActivationRow[],
  clock: SelfClock,
  asOf: string,
  sky?: TransitRangePayload | null,
): Record<SelfFamilyAgentId, SelfFamilyPack> {
  const v = view.version;

  // 1. family.rasi — D1 houses (with Argala & SAV), D1 planets (dignity, shadbala, 5-system avasthas, solar proximity, dispositor & star chains, dashaCharter), points (AL, SL, HL, GL, MD, GK, Sphutas, Karakas), yogas, stars
  const rasiKeys: string[] = [];
  const rasiLines: string[] = [`# FAMILY PACK: family.rasi (Natal D1 Houses, Argala, SAV, Planets, Avasthas, Yogas, Arudhas, Special Lagnas AL/SL/HL/GL, Upagrahas MD/GK, Karakas)`];
  for (let h = 1; h <= 12; h++) {
    const hc = view.house('D1', h);
    if (!hc) continue;
    const key = `house:D1.h${h}`;
    rasiKeys.push(key);
    const occ = hc.occupants.map((o) => `${o.planet}(${o.dignity ?? '?'}/${o.nature ?? '?'})`).join(',');
    const arg = hc.argala
      ? `primary=[${hc.argala.primary.join(',')}] secondary=[${hc.argala.secondary.join(',')}] obstructed=[${hc.argala.obstructed.join(',')}]`
      : 'none';
    rasiLines.push(
      `{${key}} H${h} ${hc.sign ?? '-'} lord=${hc.lord ?? '-'}${hc.coLord ? `/${hc.coLord}` : ''}(in H${hc.lordHouse ?? '?'},${hc.lordDignity ?? '?'}) occ=[${occ}] aspGraha=[${hc.aspectedGraha.join(',')}] aspRasi=[${hc.aspectedRasi.join(',')}] argala={${arg}} sav=${hc.sav ?? 'n/a'} arudha=${hc.arudha ?? '-'} class=[${hc.class.join(',')}]`,
    );
  }
  for (const p of ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke']) {
    const pc = view.planet('D1', p);
    if (!pc) continue;
    const key = `planet:D1.${p}`;
    rasiKeys.push(key);
    const av = pc.avasthaMultipliers
      ? `baladi=${pc.avasthaMultipliers.baladi}(${pc.avasthaMultipliers.ripeness}) jagradadi=${pc.avasthaMultipliers.jagradadi} eff=${pc.avasthaMultipliers.effective}`
      : JSON.stringify(pc.avasthas);
    const sunProx = pc.sunProximity
      ? `${pc.sunProximity.zone ?? 'near'}(${pc.sunProximity.distanceDeg != null ? pc.sunProximity.distanceDeg.toFixed(1) : '?'}deg)`
      : pc.combust
        ? 'combust'
        : 'free';
    rasiLines.push(
      `{${key}} ${p} in H${pc.house ?? '?'} ${pc.sign ?? '-'} deg=${pc.degree != null ? pc.degree.toFixed(2) : '?'} dig=${pc.dignity ?? '-'} rx=${pc.retro ?? false} owns=[${pc.owns.join(',')}] star=${pc.star ?? '-'}(lord=${pc.starLord ?? '-'},pada=${pc.pada ?? '?'}) disp=${pc.dispositor ?? '-'}(H${pc.dispositorHouse ?? '?'}) chain=[${pc.chain.join('->')}] starChain=[${(pc.starChain ?? []).join('->')}] shadbala=${pc.shadbalaRatio ?? 'n/a'}(#${pc.shadbalaRank ?? '?'}) sun=${sunProx} avastha={${av}} conj=[${pc.conjunctions.join(',')}] aspBy=[${pc.aspectedBy.join(',')}] aspTo=[${pc.aspectsTo.join(',')}]`,
    );
  }
  for (const pt of view.points('D1')) {
    const key = `point:D1.${pt.id}`;
    rasiKeys.push(key);
    rasiLines.push(`{${key}} D1.${pt.id}: planet=${pt.planet ?? '-'} sign=${pt.sign ?? '-'} house=${pt.house ?? '-'} lord=${pt.lord ?? '-'}(H${pt.lordHouse ?? '?'})`);
  }
  for (const y of view.yogas()) {
    const key = `yoga:D1.${y.id}`;
    rasiKeys.push(key);
    rasiLines.push(`{${key}} [${y.class}] ${y.name}: planets=[${y.planets.join(',')}] houses=[${y.houses.join(',')}]`);
  }
  const st = view.star();
  if (st) {
    rasiKeys.push('star:profile');
    rasiLines.push(
      `{star:profile} moonStar=${st.moonStar ?? '-'}(lord=${st.moonStarLord ?? '-'}) lagnaStar=${st.lagnaStar ?? '-'} gandanta=[${st.gandanta.join(',')}] pendingKarmaHouses=[${(st.pendingKarmaHouses ?? []).join(',')}]`,
    );
  }
  const rasiPrefix = rasiLines.join('\n');

  // 2. family.varga — Divisional charts D2..D60 and D9 karakas/arudhas
  const vargaKeys: string[] = [];
  const vargaLines: string[] = [`# FAMILY PACK: family.varga (Divisional Charts D2..D60 & Varga Modifiers)`];
  const vargaList = ['D2', 'D3', 'D4', 'D7', 'D9', 'D10', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60'];
  for (const vg of vargaList) {
    for (const hc of view.houses(vg)) {
      if (hc.house === 1 || vg === 'D9' || vg === 'D10' || vg === 'D30') {
        const hk = `house:${vg}.h${hc.house}`;
        vargaKeys.push(hk);
        vargaLines.push(
          `{${hk}} ${vg}.H${hc.house} ${hc.sign ?? '-'} lord=${hc.lord ?? '-'}(H${hc.lordHouse ?? '?'}) occ=[${hc.occupants.map((o) => o.planet).join(',')}]`,
        );
      }
    }
    for (const p of ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke']) {
      const pc = view.planet(vg, p);
      if (!pc) continue;
      const pk = `planet:${vg}.${p}`;
      vargaKeys.push(pk);
      vargaLines.push(`{${pk}} ${vg}.${p}: H${pc.house ?? '?'} ${pc.sign ?? '-'} dig=${pc.dignity ?? '-'} owns=[${pc.owns.join(',')}] conj=[${pc.conjunctions.join(',')}]`);
    }
  }
  for (const pt of view.points('D9')) {
    const key = `point:D9.${pt.id}`;
    vargaKeys.push(key);
    vargaLines.push(`{${key}} D9.${pt.id}: planet=${pt.planet ?? '-'} sign=${pt.sign ?? '-'} house=${pt.house ?? '-'} lord=${pt.lord ?? '-'}`);
  }
  const vargaPrefix = vargaLines.join('\n');

  // 3. family.dasha — ALL stored dasha systems across every family (Primary Reading Clock, Vimshottari, all Conditional Nakshatra Dashas, all Jaimini Rasi Dashas, Yogini, Kalachakra, Tara, Moola, Karaka, Kaala, Naisargika, Sudarshana) + 9x9 Mahadasha-to-Antardasha fruition matrix
  const dashaKeys: string[] = [];
  const allDashas = allRunningDashas(activation, asOf, clock.system);
  const dashaLines: string[] = [
    `# FAMILY PACK: family.dasha (ALL ${allDashas.length} Stored Dasha Systems: Primary Clock ${clock.label} [${clock.system}], Vimshottari, Conditional Nakshatra, Jaimini Rasi, Yogini, Kalachakra, Tara, Moola, Karaka, Kaala, Naisargika & 9x9 Fruition Matrix)`,
    `CLOCK: system=${clock.system} label=${clock.label} reason=${clock.reason} confirming=[${clock.confirming.map((c) => `${c.system}:${c.label}`).join(', ')}] allSystemsCount=${allDashas.length}`,
  ];
  const spine = mdSpine(activation, clock.system, asOf);
  const run = runningChain(activation, clock.system, asOf);
  for (const row of [spine.previous, spine.running, spine.next, run.l2, run.l3, spine.nextSub]) {
    if (!row) continue;
    const k = `activation:${row.system}/${row.level}/${row.lord ?? row.sign}@${row.from}`;
    if (!dashaKeys.includes(k)) dashaKeys.push(k);
    dashaLines.push(
      `{${k}} primary=${row.system}(${clockLabel(row.system)}) family=${row.family} L${row.level} lord=${row.lord ?? row.sign} from=${row.from} to=${row.to} houses=[${row.houses.join(',')}]`,
    );
  }
  // Include EVERY stored dasha system across all families (`vimshottari`, `conditional`, `rasi`, `yogini`, `tithi_ashtottari`, `karaka`, `other`)
  for (const sysSummary of allDashas) {
    if (sysSummary.system === clock.system) continue;
    for (const r of [sysSummary.previous, sysSummary.l1, sysSummary.l2, sysSummary.l3, sysSummary.next]) {
      if (!r) continue;
      const k = `activation:${r.system}/${r.level}/${r.lord ?? r.sign}@${r.from}`;
      if (!dashaKeys.includes(k)) dashaKeys.push(k);
      dashaLines.push(
        `{${k}} clock=${r.system}(${clockLabel(r.system)}) family=${r.family} L${r.level} lord=${r.lord ?? r.sign} ${r.from}..${r.to} houses=[${r.houses.join(',')}]`,
      );
    }
  }
  const vimRun = runningChain(activation, 'vimsottari', asOf);
  const activeMdPlanets = [...new Set(allDashas.map((d) => d.l1?.lord).filter((x): x is string => Boolean(x)))];
  const activeAdPlanets = [...new Set(allDashas.map((d) => d.l2?.lord).filter((x): x is string => Boolean(x)))];
  for (const mdLord of activeMdPlanets) {
    const mdCard = view.planet('D1', mdLord);
    if (mdCard?.dashaCharter) {
      const pk = `planet:D1.${mdLord}`;
      if (!dashaKeys.includes(pk)) dashaKeys.push(pk);
      const ch = mdCard.dashaCharter;
      dashaLines.push(
        `{${pk}} MD_CHARTER(${mdLord}): H${mdCard.house ?? '?'} ${mdCard.sign ?? '-'} dig=${mdCard.dignity ?? '-'} disp=${mdCard.dispositor ?? '-'}(H${ch.dispositorHouse ?? '?'}) star=${mdCard.starLord ?? '-'}(H${ch.starLordHouse ?? '?'}) owns=[${ch.housesOwned.join(',')}] yogi=${ch.isYogi} avayogi=${ch.isAvayogi}`,
      );
      for (const adLord of activeAdPlanets) {
        const adCell = ch.fruition?.[adLord];
        if (adCell) {
          dashaLines.push(
            `{${pk}} AD_FRUITION(${mdLord}->${adLord}): houseFromMd=${adCell.houseFromMd ?? '?'} houseFromLagna=${adCell.houseFromLagna ?? '?'} class=${adCell.fruitionClass ?? '-'} 6/8=${adCell.isShadAshtaka68} 2/12=${adCell.isDwirdwadasha212} starLink=${adCell.isStarLordOfMd} dispLink=${adCell.isSignDispositorOfMd}`,
          );
        }
      }
    }
  }
  const narRun = runningChain(activation, 'narayana', asOf);
  const l2Ends = [run.l2?.to, vimRun.l2?.to, narRun.l2?.to]
    .filter((x): x is string => typeof x === 'string' && x > asOf)
    .sort();
  const dashaEndIso = l2Ends[0] ?? run.l2?.to ?? vimRun.l2?.to ?? run.l1?.to;
  const dashaExpiresAt = dashaEndIso ? new Date(`${dashaEndIso}T00:00:00Z`) : undefined;
  const dashaHorizonKey = `${clock.system}:${run.l1?.from ?? 'none'}:${run.l2?.from ?? 'none'}:${vimRun.l2?.from ?? 'none'}`;
  const dashaPrefix = dashaLines.join('\n');

  // 4. family.year — Multi-year Varshaphal (VP) and Tithi Pravesha (TP) across 2025, 2026, 2027 and D1..D60 + tithi_ashtottari & mudda
  const yearKeys: string[] = [];
  const yearLines: string[] = [`# FAMILY PACK: family.year (Multi-Year Tithi Pravesha & Varshaphal 2025/2026/2027 across D1..D60 + Tithi Ashtottari & Mudda)`];
  const mudda = runningMudda(view, asOf);
  const tpRow = runningTp(view, asOf, mudda?.row.year);
  for (const a of view.annual()) {
    const ak = `annual:${a.kind}${a.year}.${a.varga}`;
    if (!yearKeys.includes(ak)) yearKeys.push(ak);
    yearLines.push(
      `{${ak}} ${a.kind}${a.year}.${a.varga} lagna=${a.lagna ?? '-'} yearLord=${a.yearLord ?? '-'} muntha=${a.muntha ? `H${a.muntha.house ?? '?'}(${a.muntha.sign ?? '-'})` : '-'}`,
    );
    for (const hc of a.houses) {
      if (hc.occupants.length > 0 || hc.house === 1 || hc.house === 6 || hc.house === 8 || hc.house === 10) {
        yearLines.push(
          `{${ak}} ${a.kind}${a.year}.${a.varga}.H${hc.house} ${hc.sign ?? '-'} lord=${hc.lord ?? '-'}(in H${hc.lordHouse ?? '?'},${hc.lordDignity ?? '?'}) occ=[${hc.occupants.map((o) => `${o.planet}:${o.dignity ?? '?'}`).join(',')}]`,
        );
      }
    }
    for (const ty of (a.tajakaYogas ?? []).filter((t) => t.present)) {
      yearLines.push(`{${ak}} TajakaYoga ${ty.id}=present`);
    }
    for (const sh of (a.sahams ?? []).slice(0, 12)) {
      yearLines.push(`{${ak}} Saham ${sh.name}: ${sh.sign ?? '-'} H${sh.house ?? '?'}`);
    }
    for (const d of a.dashas ?? []) {
      const activeP = d.periods.find((p) => p.from <= asOf && p.to > asOf) ?? d.periods[0];
      const allP = d.periods.slice(0, 9).map((p) => `${p.lord}(${p.from}..${p.to})`).join(', ');
      yearLines.push(`{${ak}} AnnualDasha ${d.system}: active=${activeP ? `${activeP.lord}(${activeP.from}..${activeP.to})` : 'none'} periods=[${allP}]`);
    }
  }
  const yearEndIso = mudda?.to;
  const yearExpiresAt = yearEndIso ? new Date(`${yearEndIso}T00:00:00Z`) : undefined;
  const yearHorizonKey = `vp=${mudda?.row.year ?? 'none'}|tp=${tpRow?.year ?? 'none'}|m=${mudda?.from ?? 'annual'}`;
  const yearPrefix = yearLines.join('\n');

  // 5. family.sky — Universal Gochara Transit Sky + Ashtakavarga SAV bindus + sensitive points (BB, K64M, K64L, KD22)
  const skyKeys: string[] = [];
  const skyLines: string[] = [`# FAMILY PACK: family.sky (Universal Gochara Transit Sky & Sarvashtakavarga SAV Gate)`];
  const signToHouse = new Map<string, number>();
  for (let h = 1; h <= 12; h++) {
    const hc = view.house('D1', h);
    if (!hc) continue;
    if (hc.sign) signToHouse.set(hc.sign, h);
    const hk = `house:D1.h${h}`;
    skyKeys.push(hk);
    skyLines.push(`{${hk}} H${h} ${hc.sign ?? '-'} SAV=${hc.sav ?? 'n/a'} lord=${hc.lord ?? '-'} occ=[${hc.occupants.map((o) => o.planet).join(',')}]`);
  }
  const mo = view.planet('D1', 'Mo');
  if (mo) {
    skyKeys.push('planet:D1.Mo');
    skyLines.push(`{planet:D1.Mo} Natal Moon in H${mo.house ?? '?'} ${mo.sign ?? '-'} star=${mo.star ?? '-'}`);
  }
  for (const code of ['BB', 'K64M', 'K64L', 'KD22', 'AL', 'SL', 'HL', 'MD', 'GK']) {
    const pt = view.points('D1').find((p) => p.id === code);
    if (!pt) continue;
    const pk = `point:D1.${code}`;
    if (!skyKeys.includes(pk)) skyKeys.push(pk);
    skyLines.push(`{${pk}} ${code}: sign=${pt.sign ?? '-'} house=${pt.house ?? '-'} lord=${pt.lord ?? '-'}`);
  }
  let skyEndIso: string | undefined;
  if (sky?.ingresses?.length) {
    skyLines.push(`UNIVERSAL_TRANSIT_SKY range=${sky.from}..${sky.to}`);
    const activeIngs = sky.ingresses.filter((r) => r.from <= asOf && asOf <= r.to);
    for (const ing of activeIngs) {
      const hLagna = ing.house_from_lagna || signToHouse.get(ing.sign) || '?';
      skyLines.push(`{house:D1.h1} Transit ${ing.planet} in ${ing.sign} (${ing.from}..${ing.to}) H${hLagna} from Lagna${mo?.sign === ing.sign ? ' [OVER NATAL MOON]' : ''}`);
    }
    const slowEnds = activeIngs
      .filter((r) => ['Sa', 'Ju', 'Ra', 'Ke', 'Ma'].includes(r.planet) && r.to > asOf)
      .map((r) => r.to)
      .sort();
    skyEndIso = slowEnds[0];
  } else {
    skyLines.push(`UNIVERSAL_TRANSIT_SKY evaluated via natal SAV bindus, Khara points (K64M/K64L/KD22), and annual return positions.`);
  }
  const skyExpiresAt = skyEndIso ? new Date(`${skyEndIso}T00:00:00Z`) : undefined;
  const skyHorizonKey = `sky=${sky ? `${sky.from}:${sky.to}:${asOf.slice(0, 7)}` : asOf.slice(0, 7)}`;
  const skyPrefix = skyLines.join('\n');

  return {
    'family.rasi': {
      id: 'family.rasi',
      natal: true,
      horizonKey: 'natal',
      prefix: rasiPrefix,
      dynamic: `Analyze the natal D1 promise across all 12 houses (H1..H12), Argala & Virodhargala, SAV bindus, Special Lagnas (AL, SL, HL, GL), Upagrahas (Mandi MD, Gulika GK, Prana/Deha/Mrityu Sphutas), Chara Karakas (AK..DK), 5-system avasthas & delivery multipliers, solar proximity, dispositor & star-lord chains, yogas, and anatomical/somatic correspondences (head, brain, food intake/neck, hands/arms, heart/chest, internal organs/weight, blood flow, legs/knees/ankles/feet). Cite exact {key} evidence in every bullet.`,
      packHash: shortHash(`${v}|rasi|${rasiPrefix}`),
      keys: rasiKeys,
      charts: ['house', 'planet', 'point', 'yoga', 'star'].map((s) => ({ type: `digest.${s}`, variant: v })),
    },
    'family.varga': {
      id: 'family.varga',
      natal: true,
      horizonKey: 'natal',
      prefix: vargaPrefix,
      dynamic: `Analyze the divisional Varga confirmations and contradictions (D9 Navamsa & Karakamsa, D10 Dasamsa, D30 Trimsamsa physical/constitutional vulnerability, D60 Shashtiamsa root karma) that elevate, modify, or delay the D1 natal promise. Cite exact {key} evidence in every bullet.`,
      packHash: shortHash(`${v}|varga|${vargaPrefix}`),
      keys: vargaKeys,
      charts: ['house', 'planet', 'point'].map((s) => ({ type: `digest.${s}`, variant: v })),
    },
    'family.dasha': {
      id: 'family.dasha',
      natal: false,
      horizonKey: dashaHorizonKey,
      ...(dashaExpiresAt ? { expiresAt: dashaExpiresAt } : {}),
      prefix: dashaPrefix,
      dynamic: `AS_OF: ${asOf}. Weigh the primary reading clock (${clock.label}) alongside Vimshottari Dasha, Jaimini Narayana Dasha, and confirming clocks; analyze previous/running/next chapters, the running Antardasha/Pratyantardasha, its 9x9 fruition relationship from the Mahadasha lord, and how these clocks activate the self, mind, and body houses (H1..H12). Cite exact {key} evidence in every bullet.`,
      packHash: shortHash(`${v}|dasha|${dashaHorizonKey}|${dashaPrefix}`),
      keys: dashaKeys,
      charts: [{ type: 'kundli_activation', variant: clock.system }, { type: 'digest.planet', variant: v }],
    },
    'family.year': {
      id: 'family.year',
      natal: false,
      horizonKey: yearHorizonKey,
      ...(yearExpiresAt ? { expiresAt: yearExpiresAt } : {}),
      prefix: yearPrefix,
      dynamic: `AS_OF: ${asOf}. Analyze the stored 2025, 2026, and 2027 Tithi Pravesha (TP) and Varshaphal (VP) charts across D1..D60, including the active Tithi Ashtottari and Mudda dashas, Muntha, Year Lord, Tajaka yogas, and how the 2025 TP (pre-Oct 2026), 2026 TP (current month Nov 2026 and into 2027), and 2027 TP shape the body, mind, and self. Cite exact {key} evidence in every bullet.`,
      packHash: shortHash(`${v}|year|${yearHorizonKey}|${yearPrefix}`),
      keys: yearKeys,
      charts: [{ type: 'digest.annual', variant: v }],
    },
    'family.sky': {
      id: 'family.sky',
      natal: false,
      horizonKey: skyHorizonKey,
      ...(skyExpiresAt ? { expiresAt: skyExpiresAt } : {}),
      prefix: skyPrefix,
      dynamic: `AS_OF: ${asOf}. Analyze the Universal Transit Sky (Saturn, Jupiter, Rahu, Ketu, Mars over natal Lagna, Moon, and body houses), Sarvashtakavarga (SAV) bindu gates across H1..H12, and sensitive points (Bhrigu Bindu, 64th Navamsa K64M/K64L, 22nd Drekkana KD22). Cite exact {key} evidence in every bullet.`,
      packHash: shortHash(`${v}|sky|${skyHorizonKey}|${skyPrefix}`),
      keys: skyKeys,
      charts: [{ type: 'digest.house', variant: v }, { type: 'digest.point', variant: v }],
    },
  };
}

const FAMILY_SYSTEM_PROMPTS: Record<SelfFamilyAgentId, string> = {
  'family.rasi':
    'You are the Rasi (D1) Chart Family Sub-Agent for a multi-school Vedic astrology reading (Parashara BPHS, Jaimini Upadesa Sutras, Pt. Sanjay Rath, and Lunar Astro / Bhrigu Nandi Nadi). Read only the provided D1 houses (H1..H12), Argala & Virodhargala, SAV bindus, planets, Shadbala, 5-system avasthas (Baladi, Jagradadi, Deeptadi, Lajjitadi, Shayanadi), solar proximity, dispositor/nakshatra chains, Special Lagnas (AL, SL, HL, GL), Upagrahas (Mandi MD, Gulika GK, Prana/Deha/Mrityu Sphutas), Chara Karakas (AK..DK), yogas, and somatic/anatomical correspondences (head/brain/nerves H1/H3/H5, food intake/diet/neck/throat H2, hands/arms/shoulders H3, heart/chest/lungs/emotional mind H4, internal organs/stomach/digestive fire/liver/weight balance H5/H6, cellular recovery H8, blood flow/circulation Ma/Su/Mo, hips/thighs H9, knees/joints/bones H10, legs/calves/ankles H11, feet/sleep/lymphatic drainage H12). Never invent placements or mention calculation software. Cite `{evidence_key}` on every bullet and end with `VALID_UNTIL: always`.',
  'family.varga':
    'You are the Divisional Varga (D2..D60) Chart Family Sub-Agent. Audit how D9 (Navamsa/Karakamsa), D10 (Dasamsa), D30 (Trimsamsa physical/constitutional vulnerabilities), and D60 (Shashtiamsa root karma) confirm, modify, or obstruct the D1 placements across identity, mind, soul, and body. Never invent placements or mention calculation software. Cite `{evidence_key}` on every bullet and end with `VALID_UNTIL: always`.',
  'family.dasha':
    'You are the Multi-Clock Dasha Family Sub-Agent. Weigh the primary reading clock alongside Vimshottari Dasha, Jaimini Narayana Dasha, and confirming clocks; audit the previous/running/next Mahadasha chapters, the active Antardasha/Pratyantardasha, and the 9x9 Mahadasha-to-Antardasha fruition geometry (Trikona, Kendra, 2/12, 6/8) across H1..H12. Never invent dates or mention calculation software. Cite `{evidence_key}` on every bullet and end with `VALID_UNTIL: <YYYY-MM-DD>` naming the exact active Antardasha/Pratyantardasha boundary date.',
  'family.year':
    'You are the Annual Return (Tithi Pravesha & Varshaphal) Family Sub-Agent. Audit the stored 2025, 2026, and 2027 Tithi Pravesha (TP) and Varshaphal (VP) charts across D1..D60, Year Lord, Muntha, Tajaka yogas, Sahams, and active Tithi Ashtottari / Mudda dashas covering the current year and upcoming year. Never invent placements or mention calculation software. Cite `{evidence_key}` on every bullet and end with `VALID_UNTIL: <YYYY-MM-DD>` naming the active annual sub-period or return boundary date.',
  'family.sky':
    'You are the Gochara Sky & Ashtakavarga Family Sub-Agent. Audit the Universal Gochara Transit Sky (Saturn, Jupiter, Rahu, Ketu, Mars over natal Lagna, Moon, and body houses), Sarvashtakavarga (SAV) house bindus across H1..H12, and sensitive transit points (BB, K64M, K64L, KD22, AL, SL, HL, MD, GK). Never invent placements or mention calculation software. Cite `{evidence_key}` on every bullet and end with `VALID_UNTIL: <YYYY-MM-DD>` naming the active slow-planet transit boundary.',
};

/** Extracts bullet claims and `{evidence}` citations from a sub-agent or lineman text block for the Admin Lab trace. */
export function parseLinemanClaims(
  text: string,
  allowedKeys: ReadonlySet<string>,
): {
  claims: Array<{ id: string; text: string; rows: string[]; certainty: LineCertainty }>;
  dropped: Array<{ claim: string; why: string }>;
} {
  const claims: Array<{ id: string; text: string; rows: string[]; certainty: LineCertainty }> = [];
  const dropped: Array<{ claim: string; why: string }> = [];
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^([-*•]|\d+\.)\s+/.test(l));
  let idx = 0;
  for (const raw of lines) {
    idx += 1;
    const cited = [...raw.matchAll(/\{([^}]+)\}/g)]
      .flatMap((m) => m[1]!.split(',').map((s) => s.trim()))
      .filter((k) => k.includes(':'));
    const validRows = cited.filter((k) => allowedKeys.has(k));
    const clean = redactEngineTerms(raw.replace(/^([-*•]|\d+\.)\s+/, '').replace(/\s*\{[^}]+\}/g, '').trim());
    if (!clean) continue;
    if (cited.length > 0 && validRows.length === 0) {
      dropped.push({ claim: clean, why: `Unresolved evidence keys: ${cited.join(', ')}` });
      continue;
    }
    const certainty: LineCertainty = /\b(confirmed|converge|both)\b/i.test(clean)
      ? 'strong'
      : /\b(split|mixed|tension)\b/i.test(clean)
        ? 'possible'
        : 'fact';
    claims.push({
      id: `claim.${idx}`,
      text: clean,
      rows: validRows,
      certainty,
    });
  }
  return { claims, dropped };
}

/** Parses `VALID_UNTIL` and `PANEL_SYNTHESIS` blocks from Lineman / Oracle output so AI synthesis enriches panel cards and sets exact cache validity horizons. */
export function parseOracleStructuredBlocks(
  text: string,
  allowedKeys: ReadonlySet<string>,
): {
  validUntil: Partial<Record<BoardPanelId | 'overall', string>>;
  panelLines: Partial<Record<BoardPanelId, Array<{ text: string; claimIds: string[]; range?: LineRange; certainty?: LineCertainty; detail?: string }>>>;
  panelPlans: Partial<Record<BoardPanelId, PanelPlan>>;
} {
  const blocks = splitPlanBlocks(text);
  text = blocks.rest;
  const validUntil: Partial<Record<BoardPanelId | 'overall', string>> = {};
  const panelLines: Partial<Record<BoardPanelId, Array<{ text: string; claimIds: string[]; range?: LineRange; certainty?: LineCertainty; detail?: string }>>> = {};

  for (const m of text.matchAll(/[-*•]?\s*(overall|diagnosis|chapters|lagna|mind|body|atma|yogas|heart|partner|bond|circle|vocation|standing|ground|gain|struggle|year|VALID_UNTIL)\s*:\s*(always|\d{4}-\d{2}-\d{2})/gi)) {
    const rawKey = m[1]!.toLowerCase();
    const val = m[2]! === 'always' ? 'always' : m[2]!;
    if (rawKey === 'valid_until' || rawKey === 'overall') {
      validUntil.overall = val;
    } else {
      validUntil[rawKey as BoardPanelId] = val;
    }
  }

  for (const m of text.matchAll(/[-*•]?\s*\[(diagnosis|chapters|lagna|mind|body|atma|yogas|heart|partner|bond|circle|vocation|standing|ground|gain|struggle|year)\]\s*\((always|\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2})\)\s*([^\n]+)/gi)) {
    const panelId = m[1]!.toLowerCase() as BoardPanelId;
    const rawRange = m[2]!;
    const body = m[3]!.trim();
    const cited = [...body.matchAll(/\{([^}]+)\}/g)]
      .flatMap((x) => x[1]!.split(',').map((s) => s.trim()))
      .filter((k) => allowedKeys.has(k));
    const cleanText = redactEngineTerms(body.replace(/\s*\{[^}]+\}/g, '').trim());
    if (!cleanText || wordCount(cleanText) > MAX_LINE_WORDS) continue;
    let range: LineRange = 'always';
    if (/^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/.test(rawRange)) {
      const [from, to] = rawRange.split('..');
      range = { from: from!, to: to! };
      if (!validUntil[panelId]) validUntil[panelId] = to!;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawRange)) {
      if (!validUntil[panelId]) validUntil[panelId] = rawRange;
    }
    const list = panelLines[panelId] ?? [];
    list.push({
      text: cleanText,
      claimIds: cited,
      range,
      certainty: 'strong',
      detail: cited.length ? `AI synthesis (${cited.join(', ')})` : 'AI multi-chart synthesis',
    });
    panelLines[panelId] = list;
  }

  return { validUntil, panelLines, panelPlans: parsePanelPlans(blocks.plan, blocks.calendar, allowedKeys) };
}

const PLAN_HEADERS = /^\s*(PANEL_SYNTHESIS|PANEL_PLAN|PANEL_CALENDAR|VALID_UNTIL)\s*:/im;

/** BG-14: cuts the PANEL_PLAN and PANEL_CALENDAR blocks out of the Oracle's text (each runs to the next block header), so their bullets are not read as card lines. */
export function splitPlanBlocks(text: string): { rest: string; plan: string; calendar: string } {
  const take = (name: string, src: string): { body: string; rest: string } => {
    const at = src.search(new RegExp(`^\\s*${name}\\s*:`, 'im'));
    if (at < 0) return { body: '', rest: src };
    const after = src.slice(at).replace(new RegExp(`^\\s*${name}\\s*:`, 'i'), '');
    const next = after.search(PLAN_HEADERS);
    const body = next < 0 ? after : after.slice(0, next);
    return { body, rest: src.slice(0, at) + (next < 0 ? '' : after.slice(next)) };
  };
  const a = take('PANEL_PLAN', text);
  const b = take('PANEL_CALENDAR', a.rest);
  return { rest: b.rest, plan: a.body, calendar: b.body };
}

const keysIn = (body: string, allowed: ReadonlySet<string>): string[] =>
  [...body.matchAll(/\{([^}]+)\}/g)].flatMap((x) => x[1]!.split(',').map((k) => k.trim())).filter((k) => allowed.has(k));
const stripKeys = (body: string): string => redactEngineTerms(body.replace(/\s*\{[^}]+\}/g, '').trim());
const rangeOf = (raw: string): { from: string; to: string } | null => {
  if (/^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [from, to] = raw.split('..');
    return from! <= to! ? { from: from!, to: to! } : null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? { from: raw, to: raw } : null;
};

/**
 * BG-14: parses the plan blocks. PANEL_PLAN bullets are `- [panel] summary: <text>` and
 * `- [panel] step (<YYYY-MM-DD..YYYY-MM-DD|always>) <text> {keys}`; PANEL_CALENDAR bullets are
 * `- [panel] (<YYYY-MM-DD|YYYY-MM-DD..YYYY-MM-DD>) <label> {keys}`. Unknown panels and undated calendar bullets are skipped.
 */
export function parsePanelPlans(plan: string, calendar: string, allowedKeys: ReadonlySet<string>): Partial<Record<BoardPanelId, PanelPlan>> {
  const out: Partial<Record<BoardPanelId, PanelPlan>> = {};
  const get = (id: BoardPanelId): PanelPlan => (out[id] ??= { summary: '', steps: [], calendar: [] });
  for (const m of plan.matchAll(/[-*•]?\s*\[(diagnosis|chapters|lagna|mind|body|atma|yogas|heart|partner|bond|circle|vocation|standing|ground|gain|struggle|year)\]\s*summary\s*:\s*([^\n]+)/gi)) {
    const t = stripKeys(m[2]!);
    if (t) get(m[1]!.toLowerCase() as BoardPanelId).summary = t;
  }
  for (const m of plan.matchAll(/[-*•]?\s*\[(diagnosis|chapters|lagna|mind|body|atma|yogas|heart|partner|bond|circle|vocation|standing|ground|gain|struggle|year)\]\s*step\s*\((always|\d{4}-\d{2}-\d{2}(?:\.\.\d{4}-\d{2}-\d{2})?)\)\s*([^\n]+)/gi)) {
    const t = stripKeys(m[3]!);
    if (!t) continue;
    const r = m[2]! === 'always' ? null : rangeOf(m[2]!);
    get(m[1]!.toLowerCase() as BoardPanelId).steps.push({ text: t, range: r ?? 'always', claimIds: keysIn(m[3]!, allowedKeys) });
  }
  for (const m of calendar.matchAll(/[-*•]?\s*\[(diagnosis|chapters|lagna|mind|body|atma|yogas|heart|partner|bond|circle|vocation|standing|ground|gain|struggle|year)\]\s*\((\d{4}-\d{2}-\d{2}(?:\.\.\d{4}-\d{2}-\d{2})?)\)\s*([^\n]+)/gi)) {
    const r = rangeOf(m[2]!);
    const label = stripKeys(m[3]!);
    if (!r || !label) continue;
    get(m[1]!.toLowerCase() as BoardPanelId).calendar.push({ ...r, label, claimIds: keysIn(m[3]!, allowedKeys) });
  }
  return out;
}

/**
 * Splits the Oracle's reading into the panels' sections (docs/reading-engine/64 §4). A section starts at a heading: a
 * markdown heading, or a short line with no sentence end, whose words contain a panel title ("Who you are & Your
 * soul's aim" feeds both `lagna` and `atma`). Text before the first heading goes to the first panel in `order`
 * (In short). Returns only the panels that received text, each tidied of rules and empty citations.
 */
export function splitOracleSections(text: string, titles: Record<string, string>, order: readonly string[]): Partial<Record<string, string>> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const entries = Object.entries(titles).map(([id, t]) => [id, norm(t)] as const);
  const isHeading = (block: string) => /^#{1,6}\s/.test(block) || (block.length <= 90 && !/[.!?]$/.test(block) && !/\n/.test(block) && !/^[-*•]/.test(block));
  const panelsFor = (heading: string): string[] => {
    const h = norm(heading.replace(/^#{1,6}\s*/, ''));
    return entries.filter(([, t]) => t && h.includes(t)).map(([id]) => id);
  };
  const out: Record<string, string[]> = {};
  let current: string[] = order.length ? [order[0]!] : [];
  for (const raw of text.split(/\n{2,}/)) {
    const block = tidyOracleParagraph(raw);
    if (!block) continue;
    if (isHeading(block)) {
      const ids = panelsFor(block);
      if (ids.length) {
        current = ids;
        continue;
      }
      // a heading naming no panel: it stays as a sub-heading of the current section
    }
    for (const id of current) (out[id] ??= []).push(block);
  }
  const result: Partial<Record<string, string>> = {};
  for (const [id, blocks] of Object.entries(out)) if (blocks.length) result[id] = blocks.join('\n\n');
  return result;
}

/** The BRIEF: one line per usable claim, `[id] (certainty) text — detail {evidence}`. Withheld claims are left out. */
export function selfBrief(reading: SelfReading, answers: Record<string, ConfirmAnswer>): { text: string; keys: Set<string> } {
  const keys = new Set<string>();
  const lines: string[] = [
    `READING CLOCK: ${reading.clock.label} (${reading.clock.reason}); confirming: ${reading.clock.confirming.map((c) => c.label).join(', ')}`,
    `TODAY: ${reading.asOf}`,
  ];
  for (const p of reading.panels) {
    if (p.status === 'failed' || p.status === 'withheld') continue;
    lines.push(`\n## ${p.title}`);
    for (const c of p.claims) {
      if (c.withheld) continue;
      c.evidence.forEach((e) => keys.add(e));
      lines.push(`[${c.id}] (${c.certainty}) ${c.text} — ${c.detail} {${c.evidence.join(', ')}}`);
    }
  }
  const facts = Object.entries(answers).map(([k, v]) => `${k}: ${v}`);
  if (facts.length) lines.push(`\nFACTS (the person's answers): ${facts.join('; ')}`);
  return { text: lines.join('\n'), keys };
}

/** Drops a paragraph that cites an evidence key not in the BRIEF. Paragraphs without citations are kept. */
export function validateSelfText(text: string, keys: Set<string>): { text: string; dropped: number } {
  let dropped = 0;
  const kept = text.split(/\n{2,}/).filter((para) => {
    const cited = [...para.matchAll(/\{([^}]+)\}/g)].flatMap((m) => m[1]!.split(',').map((s) => s.trim()));
    const ok = cited.every((k) => keys.has(k));
    if (!ok) dropped++;
    return ok;
  });
  return { text: redactEngineTerms(kept.map((p) => tidyOracleParagraph(p)).join('\n\n')), dropped };
}

/**
 * Removes a paragraph's citations and what the model wraps them in: `{keys}` and the empty backticks left behind when it
 * wrote `` `{key}` ``, a stray space before punctuation, and horizontal rules. Never touches the words.
 */
export function tidyOracleParagraph(p: string): string {
  return p
    .replace(/`?\s*\{[^}]+\}\s*`?/g, '')
    .replace(/`\s*`/g, '')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/^\s*-{3,}\s*$/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function summarizeCall(agentId: string, model: string, res: GeminiResult, ms: number): SelfOracleStageSummary {
  const promptTokens = res.usage?.promptTokens ?? 0;
  const cachedTokens = res.usage?.cachedTokens ?? 0;
  const outputTokens = res.usage?.outputTokens ?? 0;
  const thoughtTokens = res.usage?.thoughtTokens ?? 0;
  const cost =
    Math.round(
      usageCostUsd({
        model,
        promptTokens,
        cachedTokens,
        outputTokens,
        thoughtTokens,
      }) * 1e6,
    ) / 1e6;
  return {
    agentId,
    status: 'ok',
    cached: false,
    ms,
    inputTokens: promptTokens,
    promptTokens,
    outputTokens,
    cachedTokens,
    thoughtTokens,
    costUsd: cost,
    summary: res.text.slice(0, 240),
  };
}

export async function runSelfOracle(
  reading: SelfReading,
  answers: Record<string, ConfirmAnswer>,
  ctx?: SelfOracleContext,
): Promise<SelfOracleResult> {
  if (!isSelfReadingModelEnabled()) return { status: 'off' };
  const maxSpendUsd = getSelfReadingMaxSpendUsd();
  const brief = selfBrief(reading, answers);

  // Fallback path when invoked without full DB/digest context (e.g. standalone unit tests)
  if (!ctx) {
    try {
      const readerModel = modelFor('reader');
      const oracleModel = modelFor('oracle');
      const t0 = performance.now();
      const findings = await callGemini({
        model: readerModel,
        node: 'self.reader',
        system: PROMPTS['readers/R15-self'] ?? '',
        parts: [brief.text],
        thinking: 'medium',
        maxOutputTokens: 3500,
      });
      const s1 = summarizeCall('lineman.self', readerModel, findings, Math.round((performance.now() - t0) * 100) / 100);
      if (s1.costUsd > maxSpendUsd) {
        return { status: 'budget_exceeded', calls: 1, modelCalls: 1, spentUsd: s1.costUsd, costUsd: s1.costUsd, maxSpendUsd, capUsd: maxSpendUsd, stages: [s1] };
      }
      const t1 = performance.now();
      const out = await callGemini({
        model: oracleModel,
        node: 'self.oracle',
        system: PROMPTS['oracle/self'] ?? '',
        parts: [brief.text, `FINDINGS:\n${findings.text}\n\nCite evidence keys in {braces} at the end of each paragraph.`],
        thinking: 'medium',
        maxOutputTokens: getSelfOracleMaxOutputTokens(),
      });
      const s2 = summarizeCall('self.reading_oracle', oracleModel, out, Math.round((performance.now() - t1) * 100) / 100);
      const spentUsd = Math.round((s1.costUsd + s2.costUsd) * 1e6) / 1e6;
      const v = validateSelfText(out.text, brief.keys);
      const structured = parseOracleStructuredBlocks(`${findings.text}\n\n${out.text}`, brief.keys);
      return {
        status: 'ok',
        text: v.text,
        output: v.text,
        brief: brief.text,
        promptName: 'oracle/self',
        promptVersion: PROMPT_VERSION,
        model: oracleModel,
        validator: {
          verdict: v.dropped === 0 ? 'ok' : 'rejected',
          issues: v.dropped ? [`Dropped ${v.dropped} paragraph(s) citing unverified keys`] : [],
        },
        tokens: {
          prompt: (s1.promptTokens ?? 0) + (s2.promptTokens ?? 0),
          cached: s1.cachedTokens + s2.cachedTokens,
          output: s1.outputTokens + s2.outputTokens,
          thought: (s1.thoughtTokens ?? 0) + (s2.thoughtTokens ?? 0),
        },
        ms: Math.round(((s1.ms ?? 0) + (s2.ms ?? 0)) * 100) / 100,
        linemanFindings: redactEngineTerms(findings.text),
        panelLines: structured.panelLines,
        panelPlans: structured.panelPlans,
        validUntil: structured.validUntil,
        dropped: v.dropped,
        calls: 2,
        modelCalls: 2,
        cached: false,
        spentUsd,
        costUsd: spentUsd,
        maxSpendUsd,
        capUsd: maxSpendUsd,
        spentTodayUsd: spentUsd,
        stages: [s1, s2],
      };
    } catch (e) {
      console.error('[self:oracle]', (e as Error).message);
      return { status: 'failed', calls: 2, maxSpendUsd, capUsd: maxSpendUsd };
    }
  }

  // Full Doc 63 Pipeline: Reusable Family AI Sub-Agents -> Board Lineman -> Board Oracle Synthesizer
  const { prisma, userId, kundliId, view, activation, sky } = ctx;
  const board: ReadingBoardId = ctx.board ?? 'self';
  const linemanAgentId = `lineman.${board}`;
  const oracleAgentId = `${board}.reading_oracle`;
  const oracleTechniqueId = `${board}.reading.oracle`;
  const scopeKey: BoardPanelId | 'all' = ctx.only ?? 'all';
  const activeFamilyIds = FAMILY_AGENTS_BY_SCOPE[scopeKey] ?? SELF_FAMILY_AGENT_IDS;
  const now = ctx.now ?? new Date(`${reading.asOf}T12:00:00Z`);
  const owner = { userId, kundliId };
  const packs = buildSelfFamilyPacks(view, activation, reading.clock, reading.asOf, sky);
  const allKeys = new Set<string>(brief.keys);
  for (const familyId of activeFamilyIds) {
    for (const k of packs[familyId].keys) allKeys.add(k);
  }
  const answersKey = shortHash(JSON.stringify(Object.entries(answers).sort(([a], [b]) => a.localeCompare(b))));
  const mudda = runningMudda(view, reading.asOf);
  const tpRow = runningTp(view, reading.asOf, mudda?.row.year);
  // the prompt bundle version and the output shape are part of the key: a prompt change, or switching to the area
  // document, never serves an output written under the old prompt (doc 65 Phase A found the opposite)
  const oracleDigestVersion = `${view.version}|board=${board}|scope=${scopeKey}|clock=${reading.clock.system}|tp=${tpRow?.year ?? 'none'}|sky=${sky ? '1' : '0'}|ans=${answersKey}|${ctx.codeVersion ?? 'code'}|p=${PROMPT_VERSION}|shape=${isSelfOracleAreasEnabled() ? 'areas' : 'essay'}`;

  const boardFocusInstruction =
    board === 'love'
      ? `BOARD: LOVE & RELATIONSHIPS (love.reading). Focus your Vedic synthesis on H7 (partnership), H5 (heart & romance), H2 (family & sustenance), H4 (home & emotional peace), H8 (intimacy & shared vulnerability), H11 (friends & community), H12 (bed pleasures & release), L7, L5, Venus, Moon, Jupiter, Darakaraka (DK), Putrakaraka (PK), Upapada Lagna (UL), 2nd from UL, Darapada (A7), Navamsa (D9), Saptamsa (D7), active multi-clock chapters, and 2025/2026/2027 Tithi Pravesha & Varshaphal. In PANEL_SYNTHESIS, emit lines for [diagnosis|chapters|heart|partner|bond|circle|struggle|year] (<= 22 words per line, zero chart jargon in PANEL_SYNTHESIS lines).`
      : board === 'work'
        ? `BOARD: WORK, CAREER & WEALTH (work.reading). Focus your Vedic synthesis on H10 (vocation & karma), H6 (service, execution & competition), H11 (gains & networks), H2 (treasury & resources), H3 (initiative & skills), H9 (dharma & mentorship), L10, L6, L11, L2, Amatyakaraka (AmK), Saturn, Sun, Mercury, Jupiter, Mars, Arudha Lagna (AL), Rajyapada (A10), Ghatika Lagna (GL), Hora Lagna (HL), Sree Lagna (SL), Indu Lagna (IL), Labhapada (A11), Dhanapada (A2), Dasamsa (D10), Hora (D2), Karakamsa (D9.AK), SAV bindus, active multi-clock chapters, and 2025/2026/2027 Tithi Pravesha & Varshaphal. In PANEL_SYNTHESIS, emit lines for [diagnosis|chapters|vocation|standing|ground|gain|struggle|year] (<= 22 words per line, zero chart jargon in PANEL_SYNTHESIS lines).`
        : `BOARD: SELF (self.reading). In PANEL_SYNTHESIS, emit lines for [diagnosis|chapters|lagna|mind|body|atma|yogas|struggle|year] (<= 22 words per line, zero chart jargon in PANEL_SYNTHESIS lines).`;

  try {
    const stored = await withTechniqueOutput<SelfOracleResult>(
      prisma,
      {
        technique: oracleTechniqueId,
        kundliId,
        digestVersion: oracleDigestVersion,
        context: { now, runningPeriod: ctx.runningSpan ?? null },
        agentId: oracleAgentId,
        userId,
        charts: activeFamilyIds.flatMap((id) => packs[id].charts),
        forceRefresh: Boolean(ctx.force),
      },
      async () => {
        // the page asked for the store only: nothing covers today, so say so and run no model (the sentinel is not stored)
        if (ctx.mode === 'cached_only') {
          const pending: SelfOracleResult = { status: 'pending', calls: 0, maxSpendUsd, capUsd: maxSpendUsd, cached: false };
          return { value: pending, skipStore: true };
        }
        let spentUsd = 0;
        let calls = 0;
        const stages: SelfOracleStageSummary[] = [];
        const linemen: SelfOracleLinemanRecord[] = [];
        const familyFindings: Record<string, string> = {};
        const readerModel = modelFor('reader');
        const oracleModel = modelFor('oracle');

        // Stage 1: Reusable Chart-Family AI Sub-Agents (`family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`)
        // Shared across Self, Love, and Work via `self:${kundliId}:${familyId}:...`
        // The readers are independent, so they run in parallel (BUILD-GAPS BG-03): run one after another, a cold
        // build spent ~30s here and the whole request outran CloudFront's 60s origin timeout. Results are merged
        // below in `activeFamilyIds` order so stages, linemen and the bundle text stay deterministic.
        type FamilyOut = {
          familyId: SelfFamilyAgentId;
          finding?: string;
          lineman?: SelfOracleLinemanRecord;
          stage: SelfOracleStageSummary;
          called: boolean;
        };
        const budgetBlocked = spentUsd >= maxSpendUsd;
        const familyOuts = await Promise.all(
          activeFamilyIds.map(async (familyId): Promise<FamilyOut> => {
          const pack = packs[familyId];
          const cacheKey = `self:${kundliId}:${familyId}:${pack.packHash}:${PROMPT_VERSION}`;
          const cached = !ctx.force ? await loadDbReaderCache(prisma, cacheKey, owner) : undefined;
          const cachedText = (cached?.finding as unknown as { rawText?: string } | undefined)?.rawText;
          if (cachedText) {
            const parsed = parseLinemanClaims(cachedText, new Set(pack.keys));
            return {
              familyId,
              finding: cachedText,
              called: false,
              lineman: {
              agent: familyId,
              promptName: familyId,
              promptVersion: PROMPT_VERSION,
              sliceKeys: pack.keys.slice(0, 60),
              claims: parsed.claims,
              dropped: parsed.dropped,
              tokens: { prompt: 0, cached: 0, output: 0, thought: 0 },
              ms: 0,
              cache: 'hit',
              cached: true,
              },
              stage: {
              agentId: familyId,
              status: 'cached',
              cached: true,
              ms: 0,
              inputTokens: 0,
              promptTokens: 0,
              outputTokens: 0,
              cachedTokens: 0,
              thoughtTokens: 0,
              costUsd: 0,
              summary: cachedText.slice(0, 240),
              },
            };
          }

          if (budgetBlocked) {
            return {
              familyId,
              called: false,
              stage: {
              agentId: familyId,
              status: 'skipped',
              cached: false,
              ms: 0,
              inputTokens: 0,
              promptTokens: 0,
              outputTokens: 0,
              cachedTokens: 0,
              thoughtTokens: 0,
              costUsd: 0,
              },
            };
          }

          // the pack goes to the Gemini cache first, and the call waits for it (Sachin, 2026-11-08): the reader then runs on
          // the cached prefix; with READING_EXPLICIT_CACHE off this returns at once and the call goes uncached
          await ensurePromptCache(readerModel, FAMILY_SYSTEM_PROMPTS[familyId], pack.prefix, owner).catch(() => null);
          const tStart = performance.now();
          const res = await withAgentRun(
            prisma,
            familyId,
            {
              userId,
              kundliId,
              technique: oracleTechniqueId,
              task: `${familyId} ${reading.asOf}`,
              input: { family: familyId, keys: pack.keys.length, natal: pack.natal ? 1 : 0 },
            },
            async () => {
              const g = await callGemini({
                model: readerModel,
                node: familyId,
                system: FAMILY_SYSTEM_PROMPTS[familyId],
                parts: [pack.prefix, pack.dynamic],
                thinking: 'medium',
                maxOutputTokens: 2000,
                cachePrefix: true,
                cacheOwner: owner,
              });
              const pTok = g.usage?.promptTokens ?? 0;
              const cTok = g.usage?.cachedTokens ?? 0;
              const oTok = g.usage?.outputTokens ?? 0;
              const tTok = g.usage?.thoughtTokens ?? 0;
              const callCost = usageCostUsd({
                model: readerModel,
                promptTokens: pTok,
                cachedTokens: cTok,
                outputTokens: oTok,
                thoughtTokens: tTok,
              });
              return {
                value: g,
                tokensIn: pTok,
                tokensOut: oTok,
                costUsd: callCost,
                charts: pack.charts,
                output: { chars: g.text.length, cachedTokens: cTok },
              };
            },
          );
          const ms = Math.round((performance.now() - tStart) * 100) / 100;
          const st = summarizeCall(familyId, readerModel, res, ms);
          const cleanFinding = redactEngineTerms(res.text);

          const parsed = parseLinemanClaims(cleanFinding, new Set(pack.keys));
          const lineman: SelfOracleLinemanRecord = {
            agent: familyId,
            promptName: familyId,
            promptVersion: PROMPT_VERSION,
            sliceKeys: pack.keys.slice(0, 60),
            claims: parsed.claims,
            dropped: parsed.dropped,
            tokens: {
              prompt: st.promptTokens ?? 0,
              cached: st.cachedTokens,
              output: st.outputTokens,
              thought: st.thoughtTokens ?? 0,
            },
            ms,
            cache: 'run',
            cached: false,
          };

          const held: HeldReader = {
            finding: { reader: familyId, rawText: cleanFinding } as unknown as HeldReader['finding'],
            usage: {
              node: familyId,
              model: readerModel,
              promptTokens: st.promptTokens ?? 0,
              cachedTokens: st.cachedTokens,
              outputTokens: st.outputTokens,
              thoughtTokens: st.thoughtTokens ?? 0,
              ms,
            },
          };
          await saveDbReaderCache(prisma, {
            cacheKey,
            kundliId,
            userId,
            readerId: familyId,
            packHash: pack.packHash,
            horizonKey: pack.horizonKey,
            promptVersion: PROMPT_VERSION,
            natal: pack.natal,
            ...(pack.expiresAt ? { expiresAt: pack.expiresAt } : {}),
            held,
            used: true,
          });
          return { familyId, finding: cleanFinding, lineman, stage: st, called: true };
          }),
        );
        for (const out of familyOuts) {
          stages.push(out.stage);
          if (out.lineman) linemen.push(out.lineman);
          if (out.finding !== undefined) familyFindings[out.familyId] = out.finding;
          if (out.called) {
            spentUsd = Math.round((spentUsd + out.stage.costUsd) * 1e6) / 1e6;
            calls += 1;
          }
        }

        if (spentUsd >= maxSpendUsd) {
          const budgetOut: SelfOracleResult = {
            status: 'budget_exceeded',
            linemen,
            familyFindings,
            calls,
            modelCalls: calls,
            cached: false,
            spentUsd,
            costUsd: spentUsd,
            maxSpendUsd,
            capUsd: maxSpendUsd,
            spentTodayUsd: spentUsd,
            stages,
          };
          return { value: budgetOut, summary: { status: 'budget_exceeded', calls, spentUsd } };
        }

        // Stage 2: Board Lineman (`lineman.self` / `lineman.love` / `lineman.work`)
        const familyBundleText = activeFamilyIds.map((id) => `### ${id}\n${familyFindings[id] ?? '(none)'}`).join('\n\n');
        const linemanPrefix = activeFamilyIds.map((id) => packs[id].prefix).join('\n\n');
        const linemanDynamic = `${boardFocusInstruction}\nSCOPE: ${scopeKey}\n\nFAMILY SUB-AGENT FINDINGS:\n${familyBundleText}\n\nPANEL CLAIMS BRIEF:\n${brief.text}`;
        const linemanHash = shortHash(`${oracleDigestVersion}|${familyBundleText}|${brief.text}`);
        const linemanCacheKey = `${board}:${kundliId}:${linemanAgentId}:${linemanHash}:${PROMPT_VERSION}`;
        const cachedLineman = !ctx.force ? await loadDbReaderCache(prisma, linemanCacheKey, owner) : undefined;
        let linemanFindings = (cachedLineman?.finding as unknown as { rawText?: string } | undefined)?.rawText ?? '';

        if (linemanFindings) {
          const parsedLineman = parseLinemanClaims(linemanFindings, allKeys);
          linemen.push({
            agent: linemanAgentId,
            promptName: 'readers/R15-self',
            promptVersion: PROMPT_VERSION,
            sliceKeys: [...allKeys].slice(0, 80),
            claims: parsedLineman.claims,
            dropped: parsedLineman.dropped,
            tokens: { prompt: 0, cached: 0, output: 0, thought: 0 },
            ms: 0,
            cache: 'hit',
            cached: true,
          });
          stages.push({
            agentId: linemanAgentId,
            status: 'cached',
            cached: true,
            ms: 0,
            inputTokens: 0,
            promptTokens: 0,
            outputTokens: 0,
            cachedTokens: 0,
            thoughtTokens: 0,
            costUsd: 0,
            summary: linemanFindings.slice(0, 240),
          });
        } else {
          // the packs go to the Gemini cache before the lineman runs (Sachin, 2026-11-08)
          await ensurePromptCache(readerModel, PROMPTS['readers/R15-self'] ?? '', linemanPrefix, owner).catch(() => null);
          const tLineman = performance.now();
          const linemanRes = await withAgentRun(
            prisma,
            linemanAgentId,
            {
              userId,
              kundliId,
              technique: oracleTechniqueId,
              task: `${linemanAgentId} ${reading.asOf}`,
              input: { families: Object.keys(familyFindings).length, keys: allKeys.size },
            },
            async () => {
              const g = await callGemini({
                model: readerModel,
                node: `${board}.reader`,
                system: PROMPTS['readers/R15-self'] ?? '',
                parts: [linemanPrefix, linemanDynamic],
                thinking: 'medium',
                maxOutputTokens: 3500,
                timeoutMs: LINEMAN_TIMEOUT_MS,
                cachePrefix: true,
                cacheOwner: owner,
              });
              const pTok = g.usage?.promptTokens ?? 0;
              const cTok = g.usage?.cachedTokens ?? 0;
              const oTok = g.usage?.outputTokens ?? 0;
              const tTok = g.usage?.thoughtTokens ?? 0;
              const callCost = usageCostUsd({
                model: readerModel,
                promptTokens: pTok,
                cachedTokens: cTok,
                outputTokens: oTok,
                thoughtTokens: tTok,
              });
              return {
                value: g,
                tokensIn: pTok,
                tokensOut: oTok,
                costUsd: callCost,
                charts: activeFamilyIds.flatMap((id) => packs[id].charts),
                output: { chars: g.text.length, cachedTokens: cTok },
              };
            },
          );
          const ms = Math.round((performance.now() - tLineman) * 100) / 100;
          const st = summarizeCall(linemanAgentId, readerModel, linemanRes, ms);
          stages.push(st);
          spentUsd = Math.round((spentUsd + st.costUsd) * 1e6) / 1e6;
          calls += 1;
          linemanFindings = redactEngineTerms(linemanRes.text);

          const parsedLineman = parseLinemanClaims(linemanFindings, allKeys);
          linemen.push({
            agent: linemanAgentId,
            promptName: 'readers/R15-self',
            promptVersion: PROMPT_VERSION,
            sliceKeys: [...allKeys].slice(0, 80),
            claims: parsedLineman.claims,
            dropped: parsedLineman.dropped,
            tokens: {
              prompt: st.promptTokens ?? 0,
              cached: st.cachedTokens,
              output: st.outputTokens,
              thought: st.thoughtTokens ?? 0,
            },
            ms,
            cache: 'run',
            cached: false,
          });

          const linemanStruct = parseOracleStructuredBlocks(linemanFindings, allKeys);
          const linemanValidUntil = linemanStruct.validUntil[scopeKey === 'all' ? 'overall' : scopeKey] ?? linemanStruct.validUntil.overall;
          const linemanExpiresAt =
            linemanValidUntil && linemanValidUntil !== 'always'
              ? new Date(`${linemanValidUntil}T00:00:00Z`)
              : packs['family.dasha'].expiresAt;

          await saveDbReaderCache(prisma, {
            cacheKey: linemanCacheKey,
            kundliId,
            userId,
            readerId: linemanAgentId,
            packHash: linemanHash,
            horizonKey: packs['family.dasha'].horizonKey,
            promptVersion: PROMPT_VERSION,
            natal:
              scopeKey !== 'all' &&
              ['lagna', 'mind', 'atma', 'yogas', 'heart', 'partner', 'bond', 'circle', 'vocation', 'standing', 'ground', 'gain'].includes(scopeKey),
            ...(linemanExpiresAt ? { expiresAt: linemanExpiresAt } : {}),
            held: {
              finding: { reader: linemanAgentId, rawText: linemanFindings } as unknown as HeldReader['finding'],
              usage: {
                node: `${board}.reader`,
                model: readerModel,
                promptTokens: st.promptTokens ?? 0,
                cachedTokens: st.cachedTokens,
                outputTokens: st.outputTokens,
                thoughtTokens: st.thoughtTokens ?? 0,
                ms,
              },
            },
            used: true,
          });
        }

        if (spentUsd >= maxSpendUsd) {
          const budgetOut: SelfOracleResult = {
            status: 'budget_exceeded',
            linemen,
            linemanFindings,
            familyFindings,
            calls,
            modelCalls: calls,
            cached: false,
            spentUsd,
            costUsd: spentUsd,
            maxSpendUsd,
            capUsd: maxSpendUsd,
            spentTodayUsd: spentUsd,
            stages,
          };
          return { value: budgetOut, summary: { status: 'budget_exceeded', calls, spentUsd } };
        }

        // Stage 3: Board Oracle Synthesizer (`self.reading_oracle` / `love.reading_oracle` / `work.reading_oracle`)
        const compiledBrief = `${boardFocusInstruction}\n\n${brief.text}\n\n## LINEMAN SYNTHESIS BRIEF (${linemanAgentId})\n${linemanFindings}\n\n## FAMILY SUB-AGENT FINDINGS\n${familyBundleText}`;
        // docs/reading-engine/65: the Oracle returns the dashboard's area document (JSON by schema) over the stable natal
        // packs as the cached prefix; the legacy path keeps the essay + PANEL_SYNTHESIS text
        const areasOn = isSelfOracleAreasEnabled();
        const boardPanelIds: readonly BoardPanelId[] = ctx.panelOrder ?? (board === 'love' ? LOVE_PANEL_IDS : board === 'work' ? WORK_PANEL_IDS : SELF_PANEL_IDS);
        const oracleSystem = (areasOn ? PROMPTS['oracle/self-areas'] : PROMPTS['oracle/self']) ?? '';
        const natalPrefix = (['family.rasi', 'family.varga'] as const).filter((id) => activeFamilyIds.includes(id)).map((id) => packs[id].prefix).join('\n\n') || linemanPrefix;
        const oraclePrefix = areasOn ? natalPrefix : linemanPrefix;
        const oracleParts = areasOn
          ? [oraclePrefix, `${compiledBrief}\n\nReturn the JSON document only, one entry per area of this board (${boardPanelIds.join(', ')}).`]
          : [oraclePrefix, `${compiledBrief}\n\nCite evidence keys in {braces} at the end of each paragraph, include PANEL_SYNTHESIS lines, and end with VALID_UNTIL: <YYYY-MM-DD|always>.`];
        // the Oracle's prefix goes to the Gemini cache first too
        await ensurePromptCache(oracleModel, oracleSystem, oraclePrefix, owner).catch(() => null);
        const tOracle = performance.now();
        const oracleRes = await withAgentRun(
          prisma,
          oracleAgentId,
          {
            userId,
            kundliId,
            technique: oracleTechniqueId,
            task: `${oracleTechniqueId} ${reading.asOf}`,
            input: { stages: stages.length, keys: allKeys.size },
          },
          async () => {
            const g = await callGemini({
              model: oracleModel,
              node: `${board}.oracle`,
              system: oracleSystem,
              parts: oracleParts,
              thinking: areasOn ? 'low' : 'medium',
              // nine areas × 2–4 paragraphs with dates and actions is 3–5k tokens of JSON; a cap under that truncates it
              maxOutputTokens: areasOn ? Math.max(getSelfOracleMaxOutputTokens(), 6000) : getSelfOracleMaxOutputTokens(),
              timeoutMs: ORACLE_TIMEOUT_MS,
              cachePrefix: true,
              cacheOwner: owner,
              ...(areasOn ? { responseSchema: oracleAreaSchema(boardPanelIds) } : {}),
            });
            const pTok = g.usage?.promptTokens ?? 0;
            const cTok = g.usage?.cachedTokens ?? 0;
            const oTok = g.usage?.outputTokens ?? 0;
            const tTok = g.usage?.thoughtTokens ?? 0;
            const callCost = usageCostUsd({
              model: oracleModel,
              promptTokens: pTok,
              cachedTokens: cTok,
              outputTokens: oTok,
              thoughtTokens: tTok,
            });
            return {
              value: g,
              tokensIn: pTok,
              tokensOut: oTok,
              costUsd: callCost,
              charts: activeFamilyIds.flatMap((id) => packs[id].charts),
              output: { chars: g.text.length, cachedTokens: cTok },
            };
          },
        );
        const oracleMs = Math.round((performance.now() - tOracle) * 100) / 100;
        const oracleStage = summarizeCall(oracleAgentId, oracleModel, oracleRes, oracleMs);
        stages.push(oracleStage);
        spentUsd = Math.round((spentUsd + oracleStage.costUsd) * 1e6) / 1e6;
        calls += 1;
        const cacheWarm: Record<string, number> = Object.fromEntries(stages.map((s) => [s.agentId, s.cachedTokens]));
        const totalTokensAll = stages.reduce(
          (acc, s) => ({
            prompt: acc.prompt + (s.promptTokens ?? 0),
            cached: acc.cached + s.cachedTokens,
            output: acc.output + s.outputTokens,
            thought: acc.thought + (s.thoughtTokens ?? 0),
          }),
          { prompt: 0, cached: 0, output: 0, thought: 0 },
        );

        if (areasOn) {
          const parsedDoc = parseAreaDoc(oracleRes.text);
          if (!parsedDoc) {
            const raw = oracleRes.text;
            const failed: SelfOracleResult = {
              status: 'failed',
              error: `the Oracle returned no area document (finish ${oracleRes.finishReason ?? 'unknown'}, ${raw.length} chars; head "${raw.slice(0, 80).replace(/\s+/g, ' ')}" tail "${raw.slice(-80).replace(/\s+/g, ' ')}")`,
              linemen,
              linemanFindings,
              familyFindings,
              tokens: totalTokensAll,
              ms: oracleMs,
              calls,
              modelCalls: calls,
              cached: false,
              spentUsd,
              costUsd: spentUsd,
              maxSpendUsd,
              capUsd: maxSpendUsd,
              spentTodayUsd: spentUsd,
              stages,
              cacheWarm,
            };
            return { value: failed, summary: { status: 'failed', calls, spentUsd }, skipStore: true };
          }
          const validation = validateAreaDoc(parsedDoc, {
            panelIds: boardPanelIds,
            allowedKeys: allKeys,
            boundaries: ctx.boundaries ?? new Set<string>(),
            windows: ctx.windows ?? [],
            asOf: reading.asOf,
          });
          const titles: Partial<Record<BoardPanelId, string>> = ctx.panelTitles ?? {};
          const docText = areaDocToText(validation.doc, titles, boardPanelIds);
          const panelLines: NonNullable<SelfOraclePayload['panelLines']> = {};
          const panelPlans: NonNullable<SelfOraclePayload['panelPlans']> = {};
          const validUntil: NonNullable<SelfOraclePayload['validUntil']> = { overall: validation.doc.validUntil };
          for (const area of Object.values(validation.doc.areas)) {
            if (!area) continue;
            const claimIds = area.evidence.filter((k) => !k.includes(':'));
            panelLines[area.id] = [
              {
                text: area.headline,
                claimIds,
                ...(area.validUntil !== 'always' ? { range: { from: reading.asOf, to: area.validUntil } } : {}),
                certainty: areaCertaintyToLine(area.certainty),
                detail: 'Oracle area headline',
              },
            ];
            panelPlans[area.id] = {
              summary: '',
              steps: area.actions.map((x) => ({ text: x.text, range: { from: x.from, to: x.to }, claimIds })),
              calendar: area.dates.map((d) => ({ from: d.from, to: d.to, label: d.label, claimIds, inWindow: true })),
            };
            validUntil[area.id] = area.validUntil;
          }
          const resultAreas: SelfOracleResult = {
            status: 'ok',
            text: docText,
            output: docText,
            brief: compiledBrief,
            promptName: 'oracle/self-areas',
            promptVersion: PROMPT_VERSION,
            model: oracleModel,
            validator: { verdict: validation.withheld.length ? 'rejected' : 'ok', issues: validation.gaps.slice(0, 40) },
            tokens: totalTokensAll,
            ms: oracleMs,
            linemen,
            linemanFindings,
            linemanBrief: compiledBrief,
            familyFindings,
            panelLines,
            panelPlans,
            validUntil,
            areas: validation.doc,
            areaGaps: validation.gaps,
            cacheWarm,
            dropped: validation.withheld.length,
            calls,
            modelCalls: calls,
            cached: false,
            spentUsd,
            costUsd: spentUsd,
            maxSpendUsd,
            capUsd: maxSpendUsd,
            spentTodayUsd: spentUsd,
            stages,
          };
          const overall = validation.doc.validUntil;
          const refined: DateSpan | null =
            overall !== 'always' && overall > reading.asOf ? { from: ctx.runningSpan?.from ?? new Date(`${reading.asOf}T00:00:00Z`), to: new Date(`${overall}T00:00:00Z`) } : null;
          return {
            value: resultAreas,
            summary: { status: 'ok', calls, areas: Object.keys(validation.doc.areas).length, withheld: validation.withheld.length, spentUsd },
            ...(refined ? { context: { runningPeriod: refined } } : {}),
          };
        }

        const structured = parseOracleStructuredBlocks(`${linemanFindings}\n\n${oracleRes.text}`, allKeys);
        const strippedRaw = oracleRes.text
          .replace(/\n*PANEL_SYNTHESIS:[\s\S]*$/i, '')
          .replace(/\n*VALID_UNTIL:\s*(?:always|\d{4}-\d{2}-\d{2})\s*$/i, '')
          .trim();
        const validated = validateSelfText(strippedRaw || oracleRes.text, allKeys);
        const totalTokens = stages.reduce(
          (acc, s) => ({
            prompt: acc.prompt + (s.promptTokens ?? 0),
            cached: acc.cached + s.cachedTokens,
            output: acc.output + s.outputTokens,
            thought: acc.thought + (s.thoughtTokens ?? 0),
          }),
          { prompt: 0, cached: 0, output: 0, thought: 0 },
        );

        const result: SelfOracleResult = {
          status: 'ok',
          text: validated.text,
          output: validated.text,
          brief: compiledBrief,
          promptName: 'oracle/self',
          promptVersion: PROMPT_VERSION,
          model: oracleModel,
          validator: {
            verdict: validated.dropped === 0 ? 'ok' : 'rejected',
            issues: validated.dropped ? [`Dropped ${validated.dropped} paragraph(s) citing unverified keys`] : [],
          },
          tokens: totalTokens,
          ms: oracleMs,
          linemen,
          linemanFindings,
          linemanBrief: compiledBrief,
          familyFindings,
          panelLines: structured.panelLines,
          panelPlans: structured.panelPlans,
          validUntil: structured.validUntil,
          dropped: validated.dropped,
          calls,
          modelCalls: calls,
          cached: false,
          spentUsd,
          costUsd: spentUsd,
          maxSpendUsd,
          capUsd: maxSpendUsd,
          spentTodayUsd: spentUsd,
          stages,
          cacheWarm,
        };
        const aiValidTo = structured.validUntil[scopeKey === 'all' ? 'overall' : scopeKey] ?? structured.validUntil.overall;
        const refinedPeriod: DateSpan | null =
          aiValidTo && aiValidTo !== 'always' && /^\d{4}-\d{2}-\d{2}$/.test(aiValidTo) && aiValidTo > reading.asOf
            ? {
                from: ctx.runningSpan?.from ?? new Date(`${reading.asOf}T00:00:00Z`),
                to: new Date(`${aiValidTo}T00:00:00Z`),
              }
            : null;
        return {
          value: result,
          summary: { status: 'ok', calls, dropped: validated.dropped, spentUsd },
          ...(refinedPeriod ? { context: { runningPeriod: refinedPeriod } } : {}),
        };
      },
    );

    return stored.cached ? { ...stored.value, cached: true } : stored.value;
  } catch (e) {
    console.error('[self:oracle]', (e as Error).message);
    return { status: 'failed', error: redactEngineTerms(String((e as Error).message ?? e)).slice(0, 300), calls: 0, maxSpendUsd, capUsd: maxSpendUsd };
  }
}
