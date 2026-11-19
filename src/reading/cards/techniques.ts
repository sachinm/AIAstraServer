/**
 * The Love and Work boards' own techniques in the card pack (docs/dashboards/14). Before this, every Love and Work card
 * read the You board's data only (the year frame, the agreed ledger of generic matters, the matter rows, the natal core).
 * Now a run that holds Love or Work cards also carries `# BOARD TECHNIQUES: LOVE` / `WORK`: the eight house layers of
 * houseLayers.ts over the board's area config (LOVE, WORK), the karakas and points it names, the year chart's sahams,
 * the owning divisional charts, each sub-area's support and test windows, and for Work the D1/D10 check of the running
 * lords, the annual, conditional and karaka family votes and the stored Work board map. Every row is a select of the
 * stored digest, the activation calendar, the stored sky or the stored Work map, through the existing layer code: Node
 * computes nothing astrological here.
 *
 * Each row has a citable key (`love:<layer>/<row>`, `love:sub/<subarea>`, `work:…`); a card may cite every key of the
 * board sections its mapping names (`CARD_TECHNIQUES`). A run with no Love or Work card loads and writes nothing.
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { ActivationRow } from '../digest/activation.js';
import type { DigestView } from '../digest/types.js';
import type { TransitRangePayload } from '../chartData/transitRange.js';
import {
  afflictionLayer,
  aheadWindows,
  annualLayer,
  buildBoard,
  gradeRow,
  nakshatraLayer,
  promiseLayer,
  protectionLayer,
  resolvePlanet,
  transitLayer,
  vargaLayer,
  type AreaConfig,
  type LayerId,
  type LayerRow,
} from '../area/houseLayers.js';
import { LOVE } from '../area/love.js';
import { WORK } from '../area/work.js';
import { workAnnualVote, workConditionalVote, workD10Check, workKarakaVote, type CareerMap } from '../area/career.js';
import { isAgeMatureD9 } from '../dasha/dashaAssessment.js';
import { cmp } from '../slices/render.js';
import type { BoardV3CardId } from '../boards/v3Cards.js';
import { boardV3CardDef } from '../boards/v3Cards.js';

export type TechniqueBoard = 'love' | 'work';
export const TECHNIQUE_BOARDS: readonly TechniqueBoard[] = ['love', 'work'];
export const TECHNIQUE_LAYERS: readonly LayerId[] = ['promise', 'affliction', 'protection', 'activation', 'transit', 'annual', 'varga', 'nakshatra'];

export const BOARD_CONFIG: Record<TechniqueBoard, AreaConfig> = { love: LOVE, work: WORK };

// ---------------------------------------------------------------------------------------------------------------- mapping

/** what one card reads of one board's techniques */
export interface CardTechniqueSource {
  board: TechniqueBoard;
  /** the board's sub-areas (AreaConfig.subareas ids) the card speaks to */
  subareas: readonly string[];
  /** the layers whose rows on those sub-areas the card reads first */
  layers: readonly LayerId[];
}

const TIMING: readonly LayerId[] = ['promise', 'activation', 'transit', 'annual'];
const NATURE: readonly LayerId[] = ['promise', 'varga', 'nakshatra'];
const STRAIN: readonly LayerId[] = ['affliction', 'protection', 'activation', 'transit'];
const L = (subareas: string[], layers: readonly LayerId[]): CardTechniqueSource => ({ board: 'love', subareas, layers });
const W = (subareas: string[], layers: readonly LayerId[]): CardTechniqueSource => ({ board: 'work', subareas, layers });

/**
 * Per card: the board sections and sub-areas it reads (docs/dashboards/14 §3). Typed over every v3 card id, so a card
 * added to the registry without a mapping does not compile. The Allies lens sits on the Love board but reads the Work
 * board's career rows (a boss, a team, a client is a work matter); networking also reads the Love friends rows. The Craft
 * lens has no career sub-area: it reads the Work board's layers on the career houses (promise, activation, annual,
 * varga), and the two earning cards add pay and business.
 */
export const CARD_TECHNIQUES: Record<BoardV3CardId, readonly CardTechniqueSource[]> = {
  // Love · Dating
  dating_pulse: [L(['meet', 'romance', 'delay'], TIMING)],
  dating_meeting_timing: [L(['meet', 'romance'], ['activation', 'transit', 'annual', 'varga'])],
  dating_delays_blocks: [L(['delay', 'strain'], STRAIN)],
  dating_attraction_pattern: [L(['meet', 'romance'], NATURE)],
  dating_mixed_signals: [L(['romance', 'strain'], ['promise', 'affliction', 'activation', 'transit'])],
  dating_exes_closure: [L(['reconcile', 'strain'], ['affliction', 'activation', 'transit'])],
  dating_karmic_compatibility: [L(['romance', 'commitment'], NATURE)],
  dating_intimacy_safety: [L(['health', 'romance'], ['promise', 'affliction', 'protection', 'nakshatra'])],
  dating_breaking_patterns: [L(['delay', 'strain'], ['affliction', 'protection', 'activation', 'nakshatra'])],
  dating_transition_commitment: [L(['commitment', 'meet'], ['promise', 'activation', 'varga', 'annual'])],
  // Love · Marriage
  marriage_pulse: [L(['health', 'strain', 'commitment'], ['promise', 'affliction', 'activation', 'transit', 'annual'])],
  marriage_timing_readiness: [L(['commitment', 'meet', 'delay'], ['promise', 'activation', 'varga', 'annual'])],
  marriage_daily_harmony: [L(['health'], ['promise', 'protection', 'transit', 'annual'])],
  marriage_conflict_cycles: [L(['strain', 'reconcile'], STRAIN)],
  marriage_communication: [L(['health', 'strain'], ['promise', 'affliction', 'activation'])],
  marriage_trust_transparency: [L(['health', 'strain'], ['affliction', 'protection', 'nakshatra'])],
  marriage_reconciliation: [L(['reconcile', 'strain'], STRAIN)],
  marriage_inlaws_family: [L(['family_accept'], ['promise', 'affliction', 'activation'])],
  marriage_finances_chores: [L(['family_accept', 'health'], ['promise', 'activation', 'annual'])],
  marriage_children_family: [L(['health', 'family_accept'], ['promise', 'varga', 'activation'])],
  marriage_longterm_longevity: [L(['commitment', 'health'], ['promise', 'protection', 'varga', 'nakshatra'])],
  marriage_personal_growth: [L(['health', 'commitment'], ['promise', 'varga', 'annual'])],
  // Love · Friends
  friends_social_energy: [L(['friends'], TIMING)],
  friends_core_allies: [L(['friends'], ['promise', 'protection', 'activation'])],
  friends_outgrowing_circles: [L(['friends'], ['affliction', 'activation', 'transit'])],
  friends_finding_tribe: [L(['friends'], ['activation', 'transit', 'annual'])],
  friends_boundaries_drains: [L(['friends'], ['affliction', 'protection', 'transit'])],
  friends_mentors_guides: [L(['friends'], ['promise', 'protection', 'activation'])],
  friends_reputation_belonging: [L(['friends'], ['promise', 'annual', 'varga'])],
  // Love · Allies at work: the Work board's career rows
  allies_pulse: [W(['promotion', 'job_security'], TIMING)],
  allies_bosses_authority: [W(['promotion'], ['promise', 'activation', 'varga'])],
  allies_team_politics: [W(['job_security'], ['affliction', 'protection', 'activation'])],
  allies_cofounder_fit: [W(['business'], ['promise', 'activation', 'varga'])],
  allies_clients_deals: [W(['business', 'pay'], TIMING)],
  allies_managing_people: [W(['promotion'], ['promise', 'protection', 'varga'])],
  allies_networking_allies: [W(['promotion', 'job_change'], ['activation', 'transit', 'annual']), L(['friends'], ['activation', 'transit'])],
  allies_contracts_disputes: [W(['job_security', 'business'], STRAIN)],
  // Work · Starting out
  start_launch_window: [W(['get_job'], TIMING)],
  start_degree_to_career: [W(['get_job', 'job_change'], ['promise', 'varga', 'activation'])],
  start_first_role_timing: [W(['get_job'], ['activation', 'transit', 'annual'])],
  start_offer_decision: [W(['get_job', 'job_change', 'pay'], ['activation', 'annual', 'varga'])],
  start_imposter_syndrome: [W(['get_job'], ['affliction', 'protection', 'nakshatra'])],
  start_relocation_abroad: [W(['abroad'], ['activation', 'transit', 'annual'])],
  start_three_year_foundation: [W(['get_job', 'promotion'], ['promise', 'activation', 'varga'])],
  // Work · Your job
  job_pulse: [W(['promotion', 'job_security', 'job_change'], ['promise', 'affliction', 'activation', 'transit', 'annual'])],
  job_security_layoff: [W(['job_security'], STRAIN)],
  job_stay_or_leave: [W(['job_change', 'job_security'], ['activation', 'transit', 'annual', 'affliction'])],
  job_promotion_recognition: [W(['promotion'], ['promise', 'activation', 'annual', 'varga'])],
  job_salary_bonuses: [W(['pay'], ['promise', 'activation', 'annual'])],
  job_burnout_load: [W(['job_security'], ['affliction', 'protection', 'transit', 'nakshatra'])],
  job_boss_politics: [W(['promotion', 'job_security'], ['affliction', 'protection', 'activation'])],
  job_leading_teams: [W(['promotion'], ['promise', 'protection', 'varga'])],
  job_industry_switch: [W(['job_change'], ['activation', 'transit', 'varga'])],
  job_remote_abroad: [W(['abroad', 'job_change'], ['activation', 'transit', 'annual'])],
  job_skill_building: [W(['promotion', 'job_change'], ['promise', 'varga', 'activation'])],
  // Work · Craft & hobby: the career houses' layers; the earning cards add pay and business
  craft_creative_flow: [W([], ['promise', 'activation', 'annual'])],
  craft_energizing_medium: [W([], ['promise', 'varga', 'nakshatra'])],
  craft_creative_blocks: [W([], ['affliction', 'protection', 'activation'])],
  craft_monetize_hobby: [W(['pay', 'business'], TIMING)],
  craft_shipping_projects: [W([], ['activation', 'transit', 'annual'])],
  craft_audience_community: [W(['business'], ['promise', 'activation', 'annual'])],
  // Work · Business
  biz_readiness: [W(['business', 'job_change'], ['promise', 'varga', 'activation'])],
  biz_ideal_industry: [W(['business'], NATURE)],
  biz_launch_timing: [W(['business'], TIMING)],
  biz_cashflow_margins: [W(['pay', 'business'], ['promise', 'activation', 'annual'])],
  biz_clients_sales: [W(['business', 'pay'], ['activation', 'transit', 'annual'])],
  biz_partnerships_fit: [W(['business'], ['promise', 'affliction', 'varga'])],
  biz_hiring_team: [W(['business', 'promotion'], ['promise', 'protection', 'activation'])],
  biz_capital_assets: [W(['pay', 'business'], ['promise', 'affliction', 'annual'])],
  biz_scaling_risk: [W(['business'], ['activation', 'transit', 'annual', 'affliction'])],
  biz_legal_safeguards: [W(['job_security', 'business'], STRAIN)],
  biz_founder_burnout: [W(['job_security'], ['affliction', 'protection', 'transit', 'nakshatra'])],
};

/** The technique sources of a card; empty for a Self card (it reads the You board's data as before). */
export function cardTechniques(id: string): readonly CardTechniqueSource[] {
  if (!boardV3CardDef(id)) return [];
  return CARD_TECHNIQUES[id as BoardV3CardId] ?? [];
}

/** The boards whose technique sections the cards need, in fixed order. */
export function techniqueBoardsOf(ids: Iterable<string>): TechniqueBoard[] {
  const want = new Set<TechniqueBoard>();
  for (const id of ids) for (const s of cardTechniques(id)) want.add(s.board);
  return TECHNIQUE_BOARDS.filter((b) => want.has(b));
}

// ---------------------------------------------------------------------------------------------------------------- render

export interface TechniqueRow {
  key: string;
  layer: LayerId | 'sub' | 'karaka' | 'point' | 'saham' | 'chart' | 'check' | 'family' | 'map' | 'tone';
  /** sub-area ids this row bears on (empty: the whole board) */
  subareas: string[];
  line: string;
  dates: string[];
}

export interface BoardTechniqueSection {
  board: TechniqueBoard;
  /** the rendered section (`# BOARD TECHNIQUES: LOVE` …) */
  text: string;
  rows: TechniqueRow[];
  /** every key of the section */
  keys: string[];
  /** every ISO date the section names (a card may copy them) */
  dates: string[];
}

export interface BoardTechniqueInput {
  view: DigestView;
  asOf: string;
  /** periods activating the board's houses, from 13 months back (the board service's span) */
  activation: ActivationRow[];
  /** every period running on asOf */
  running: ActivationRow[];
  transit: TransitRangePayload | null;
  ageYears: number | null;
  /** the year frame's range: activation rows are kept only when they overlap it */
  range: { from: string; to: string };
  /** Work only: the newest stored Work board map (area_builds 'career'), or null */
  careerMap?: CareerMap | null;
  /** the clocks the year frame read (`frame.clocksRead`): their periods join the board families' own clocks */
  systems?: readonly string[];
}

/**
 * The clocks whose periods the section lists and whose windows it merges (docs/dashboards/14 §4): one per board family
 * of doc 46 §B.4 (the main clock, the karaka clock, the two short clocks, the sign clock of doc 43 S4), every
 * conditional clock that applies to this chart, and the clocks the year frame read. The calendar stores 40-odd systems;
 * all of them merged make every sub-area window run for a decade, and listed they would triple the section.
 */
export const SECTION_SYSTEMS: readonly string[] = ['vimsottari', 'karaka', 'yogini', 'tithi_ashtottari', 'narayana'];
const sectionRow = (r: ActivationRow, extra: ReadonlySet<string>): boolean => r.family === 'conditional' || SECTION_SYSTEMS.includes(r.system) || extra.has(r.system);

const ISO =/\b\d{4}-\d{2}-\d{2}\b/g;
const datesIn = (s: string): string[] => [...new Set(s.match(ISO) ?? [])];
const slug = (s: string): string => s.replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');

/** the sub-areas a layer row bears on: its theme house is one of theirs, or its planet is one of their planets */
function subareasOf(view: DigestView, cfg: AreaConfig, r: { theme: string; planet?: string | null }): string[] {
  const h = /^h(\d+)$/.exec(r.theme);
  const out: string[] = [];
  for (const s of cfg.subareas) {
    const planets = s.planets.map((p) => resolvePlanet(view, p));
    if ((h && s.houses.includes(Number(h[1]))) || s.planets.includes(r.theme) || (r.planet && planets.includes(r.planet))) out.push(s.id);
  }
  return out;
}

/**
 * Pure. The board's technique rows and the rendered section. Same input, same bytes: keys come from layer, theme, kind
 * and planet (never an array index), rows are sorted by key within each layer.
 */
export function renderBoardTechniques(board: TechniqueBoard, i: BoardTechniqueInput): BoardTechniqueSection {
  const cfg = BOARD_CONFIG[board];
  const { view, asOf } = i;
  const isMature = isAgeMatureD9(i.ageYears);
  const rows: TechniqueRow[] = [];
  const used = new Set<string>();
  const add = (r: Omit<TechniqueRow, 'key' | 'dates'> & { id: string }) => {
    let key = `${board}:${r.layer}/${slug(r.id)}`;
    for (let n = 2; used.has(key); n++) key = `${board}:${r.layer}/${slug(r.id)}.${n}`;
    used.add(key);
    rows.push({ key, layer: r.layer, subareas: r.subareas, line: r.line, dates: datesIn(r.line) });
  };
  const layerRow = (r: LayerRow) => {
    const id = [r.theme, r.kind, r.planet ?? ''].filter(Boolean).join('.');
    add({ id, layer: r.layer, subareas: subareasOf(view, cfg, r), line: `${r.side} w${Math.round(r.weight * 100) / 100}${r.until ? ` until ${r.until}` : ''}: ${r.evidence.join('; ')}` });
  };
  const byKey = (a: LayerRow, b: LayerRow) => cmp([a.theme, a.kind, a.planet ?? '', a.evidence.join(';')].join('|'), [b.theme, b.kind, b.planet ?? '', b.evidence.join(';')].join('|'));

  // the board's tone today (the same buildBoard the board service runs)
  const built = buildBoard({ view, cfg, asOf, activation: i.activation, running: i.running, transit: i.transit, ageYears: i.ageYears });
  const t = built.board.tone;
  add({ id: 'now', layer: 'tone', subareas: [], line: `${t.tone} (${t.confidence})${t.date ? `, changes ${t.date}` : ''}; families ${t.families.map((f) => `${f.family}=${f.vote}`).join(', ')}` });

  // the karakas and the points the board names, always (plain selects of the digest)
  for (const ref of cfg.karakas) {
    const p = resolvePlanet(view, ref);
    const cards = p ? cfg.vargas.map((v) => ({ v, c: view.planet(v, p) })).filter((x) => x.c) : [];
    const desc = cards.map(({ v, c }) => `${v} ${c!.sign ?? '?'} h${c!.house ?? '?'}${c!.dignity ? ` ${c!.dignity}` : ''}${c!.retro ? ' retro' : ''}`).join('; ');
    add({ id: ref, layer: 'karaka', subareas: subareasOf(view, cfg, { theme: ref, planet: p }), line: p ? `${ref} = ${p}: ${desc || 'no varga card stored'}` : `${ref}: not stored` });
  }
  const pointIds = board === 'love' ? ['UL', 'A7', 'A5', 'DK'] : ['AL', 'A10', 'AmK'];
  for (const id of [...cfg.protectPoints, ...pointIds.filter((x) => !cfg.protectPoints.includes(x))]) {
    const pts = view.points().filter((x) => x.id === id && cfg.vargas.includes(x.varga));
    const desc = pts.sort((a, b) => cfg.vargas.indexOf(a.varga) - cfg.vargas.indexOf(b.varga)).map((x) => `${x.varga} ${x.sign ?? '?'} h${x.house ?? '?'} lord ${x.lord ?? '?'} in h${x.lordHouse ?? '?'}`).join('; ');
    add({ id, layer: 'point', subareas: [], line: desc ? `${id}: ${desc}` : `${id}: not stored` });
  }
  // the owning divisional charts of the first primary houses, always (the D9 7th and the D7 for Love, the D10 10th for Work)
  for (const v of cfg.vargas.filter((x) => x !== 'D1')) {
    for (const h of cfg.primary.slice(0, 3)) {
      const c = view.house(v, h);
      add({ id: `${v}.h${h}`, layer: 'chart', subareas: subareasOf(view, cfg, { theme: `h${h}` }), line: c ? `${v}.h${h} ${c.sign ?? '?'} lord ${c.lord ?? '?'}${c.lordDignity ? ` ${c.lordDignity}` : ''}${c.lordHouse != null ? ` in h${c.lordHouse}` : ''}; occupants ${c.occupants.map((o) => o.planet).join(',') || 'none'}` : `${v}.h${h}: not stored` });
    }
  }
  // the year chart's sahams the board names, always
  const year = annualLayer(view, cfg, asOf);
  for (const name of [...cfg.sahams.support, ...cfg.sahams.test]) {
    const s = year.year?.sahams.find((x) => x.name.toLowerCase() === name);
    const side = cfg.sahams.support.includes(name) ? 'support' : 'test';
    add({ id: name, layer: 'saham', subareas: [], line: !year.year ? `${name} (${side}): no year chart stored` : s ? `${name} (${side}): ${year.year.kind}${year.year.year} ${s.sign ?? '?'} h${s.house ?? '?'}` : `${name} (${side}): not in the ${year.year.kind}${year.year.year} chart` });
  }

  // the eight layers
  const sorted = (xs: LayerRow[]) => [...xs].sort(byKey);
  for (const r of sorted(promiseLayer(view, cfg, isMature))) layerRow(r);
  for (const r of sorted(afflictionLayer(view, cfg, i.running, isMature))) layerRow(r);
  for (const r of sorted(protectionLayer(view, cfg))) layerRow(r);
  // activation: the section's clocks' graded periods overlapping the frame, levels 1 and 2, with their dates
  const extra = new Set(i.systems ?? []);
  const sectionAct = i.activation.filter((r) => sectionRow(r, extra));
  const graded = sectionAct
    .filter((r) => r.level <= 2 && r.from <= i.range.to && i.range.from < r.to)
    .map((r) => gradeRow(view, cfg, r, isMature))
    .filter((g) => g.side && g.grade)
    .sort((a, b) => cmp(`${a.row.system}|${a.row.level}|${a.row.from}|${a.row.lord ?? a.row.sign}`, `${b.row.system}|${b.row.level}|${b.row.from}|${b.row.lord ?? b.row.sign}`));
  for (const g of graded) {
    const who = g.row.lord ?? g.row.sign ?? '?';
    add({
      id: `${g.row.system}.L${g.row.level}.${who}.${g.row.from}`,
      layer: 'activation',
      subareas: subareasOf(view, cfg, { theme: '', planet: g.planet }),
      line: `${g.side} ${g.grade} ${g.row.from}..${g.row.to} ${g.row.system} L${g.row.level} ${who} (houses ${g.row.houses.join(',') || '-'}): ${g.evidence.slice(1).join('; ') || 'no grade facts'}`,
    });
  }
  const tr = transitLayer(i.transit, cfg, asOf);
  if (tr === null) add({ id: 'none', layer: 'transit', subareas: [], line: 'the slow-moving sky is not stored for this chart' });
  else for (const r of sorted(tr)) layerRow(r);
  for (const r of sorted(year.rows)) layerRow(r);
  for (const r of sorted(vargaLayer(view, cfg))) layerRow(r);
  for (const r of sorted(nakshatraLayer(view, cfg, i.running))) layerRow(r);

  // each sub-area's support and test windows ahead (the board's own `aheadWindows`, over the section's clocks)
  const ahead = aheadWindows(view, cfg, sectionAct.map((r) => gradeRow(view, cfg, r, isMature)), asOf);
  for (const s of cfg.subareas) {
    const ws = ahead.filter((w) => w.subarea === s.id);
    const desc = ws.map((w) => `${w.side} ${w.grade} ${w.from}..${w.to} (${w.systems.join(', ')})`).join('; ');
    add({ id: s.id, layer: 'sub', subareas: [s.id], line: `${s.title}: ${desc || 'no graded window in 36 months'}; score next 12 months ${built.subareaScores[s.id] ?? 0}` });
  }

  // Work: the D1/D10 check of the running lords, the family votes, and the stored Work board map
  if (board === 'work') {
    const lords = [...new Set(i.running.filter((r) => r.family === 'vimshottari' && r.level <= 2 && r.lord).sort((a, b) => a.level - b.level).map((r) => r.lord!))];
    for (const p of lords) {
      const c = workD10Check(view, p, i.ageYears);
      add({ id: `d10.${p}`, layer: 'check', subareas: subareasOf(view, cfg, { theme: '', planet: p }), line: `${p} (running): D1 ${c.d1Side}, D10 ${c.d10Side}, D9 ${c.d9Side}; ${c.split ? 'split, the vote does not count' : c.agrees ? 'agrees' : 'no agreement'}; posture ${c.operatingPosture}` });
    }
    const seen = new Set<string>();
    const votes = [workConditionalVote(view, i.running, asOf, seen), workKarakaVote(view, i.running, asOf, seen), workAnnualVote(view, asOf, i.ageYears)];
    for (const [id, v] of [['conditional', votes[0]], ['karaka', votes[1]], ['annual', votes[2]]] as const) {
      add({ id, layer: 'family', subareas: [], line: v ? `${v.label}: ${v.vote}${v.planet ? ` (${v.planet})` : ''}` : `${id}: not running or not stored` });
    }
    const m = i.careerMap;
    if (m?.present) {
      add({ id: 'present', layer: 'map', subareas: [], line: `stored Work board ${m.asOf}: tone ${m.present.tone} (${m.present.confidence}), security ${m.present.security}${m.present.ease_date ? `, eases ${m.present.ease_date}` : ''}${m.present.window_end ? `, window ends ${m.present.window_end}` : ''}${m.present.next_window_start ? `, next window ${m.present.next_window_start}` : ''}` });
      for (const s of cfg.subareas) {
        const ws = (m.ahead ?? []).filter((w) => w.subarea === s.id).slice(0, 4);
        if (ws.length) add({ id: s.id, layer: 'map', subareas: [s.id], line: ws.map((w) => `${w.side} ${w.band} ${w.from}..${w.to}${w.security ? ` security ${w.security}` : ''}`).join('; ') });
      }
    } else add({ id: 'present', layer: 'map', subareas: [], line: 'no stored Work board map' });
  }

  const head = board === 'love'
    ? '# BOARD TECHNIQUES: LOVE (the Love board\'s own reading of this chart: houses 7, 5, 11, 2, 4, 8, 12; karakas the 7th lord, Venus, the Moon, the DK; the UL; D1, D9, D7)'
    : '# BOARD TECHNIQUES: WORK (the Work board\'s own reading of this chart: houses 10, 6, 1, 2, 11; karakas the 10th lord, the AmK, the Sun; D1, D10, D9, D60)';
  const LABEL: Record<TechniqueRow['layer'], string> = {
    tone: 'TONE TODAY',
    karaka: 'KARAKAS',
    point: 'POINTS',
    chart: 'DIVISIONAL CHARTS',
    saham: 'SAHAMS (this year chart)',
    promise: 'PROMISE',
    affliction: 'AFFLICTION (until = the end of the afflicting planet\'s running period)',
    protection: 'PROTECTION',
    activation: 'ACTIVATION (graded periods overlapping the frame, with their dates)',
    transit: 'TRANSIT',
    annual: 'ANNUAL',
    varga: 'VARGA',
    nakshatra: 'NAKSHATRA',
    sub: 'SUB-AREAS (support and test windows ahead; score = strength of the next 12 months)',
    check: 'D1/D10 CHECK OF THE RUNNING LORDS',
    family: 'FAMILY VOTES',
    map: 'STORED WORK BOARD MAP',
  };
  const order: Array<TechniqueRow['layer']> = ['tone', 'karaka', 'point', 'chart', 'saham', 'promise', 'affliction', 'protection', 'activation', 'transit', 'annual', 'varga', 'nakshatra', 'sub', 'check', 'family', 'map'];
  const T = [head];
  for (const l of order) {
    const rs = rows.filter((r) => r.layer === l);
    if (!rs.length) {
      if ((TECHNIQUE_LAYERS as readonly string[]).includes(l)) T.push(`## ${LABEL[l]}\n(no rows)`);
      continue;
    }
    T.push(`## ${LABEL[l]}\n${rs.map((r) => `{${r.key}} ${r.line}`).join('\n')}`);
  }
  return { board, text: T.join('\n'), rows, keys: rows.map((r) => r.key), dates: [...new Set(rows.flatMap((r) => r.dates))].sort(cmp) };
}

/** The keys a card is pointed to first: its sub-area rows, and its layers' rows on those sub-areas (all, when none). */
export function cardTechniqueKeys(id: string, sections: Partial<Record<TechniqueBoard, BoardTechniqueSection>>): Array<{ board: TechniqueBoard; keys: string[] }> {
  const out: Array<{ board: TechniqueBoard; keys: string[] }> = [];
  for (const src of cardTechniques(id)) {
    const sec = sections[src.board];
    if (!sec) continue;
    const want = new Set(src.subareas);
    const layers = new Set<string>(src.layers);
    const keys = sec.rows
      .filter((r) => {
        if (r.layer === 'sub' || r.layer === 'map') return r.subareas.some((s) => want.has(s));
        if (!layers.has(r.layer)) return false;
        return !want.size || !r.subareas.length || r.subareas.some((s) => want.has(s));
      })
      .map((r) => r.key);
    out.push({ board: src.board, keys });
  }
  return out;
}

/**
 * The card's store-key stamp for the technique rows it reads: `.t<hash>` of its board sections, '' for a Self card (its
 * key is unchanged) or when no section was loaded. A change in the rows reads the card again.
 */
export function techniqueStamp(id: string, sections: Partial<Record<TechniqueBoard, BoardTechniqueSection>> | undefined): string {
  const texts = techniqueBoardsOf([id]).map((b) => sections?.[b]?.text).filter((t): t is string => Boolean(t));
  return texts.length ? `.t${createHash('sha256').update(texts.join('\n')).digest('hex').slice(0, 12)}` : '';
}

// ---------------------------------------------------------------------------------------------------------------- load

export interface TechniqueLoadDeps {
  prisma: PrismaClient;
  loadDigest?: (prisma: PrismaClient, kundliId: string) => Promise<DigestView | null>;
  activationFor?: (prisma: PrismaClient, kundliId: string, q: { from: string; to: string; houses?: number[]; maxLevel?: 1 | 2 | 3 }) => Promise<ActivationRow[]>;
  loadTransit?: (prisma: PrismaClient, kundliId: string, asOf: string) => Promise<TransitRangePayload | null>;
  loadCareerMap?: (prisma: PrismaClient, kundliId: string) => Promise<CareerMap | null>;
}

/**
 * Loads and renders the sections the boards need, read-only (the digest, the activation calendar, the stored sky, the
 * stored Work map). Never throws: a board whose data is not there is left out, and the cards read as before.
 */
export async function loadBoardTechniques(
  deps: TechniqueLoadDeps,
  q: { kundliId: string; asOf: string; boards: readonly TechniqueBoard[]; ageYears: number | null; range: { from: string; to: string }; systems?: readonly string[] },
): Promise<Partial<Record<TechniqueBoard, BoardTechniqueSection>>> {
  const out: Partial<Record<TechniqueBoard, BoardTechniqueSection>> = {};
  if (!q.boards.length) return out;
  try {
    const [{ loadDigest }, { activationFor }, { activationSpan, defaultLoadTransit }, { latestReadyBuild }] = await Promise.all([
      import('../digest/load.js'),
      import('../digest/activation.js'),
      import('../area/boardService.js'),
      import('../area/validity.js'),
    ]);
    const view = await (deps.loadDigest ?? loadDigest)(deps.prisma, q.kundliId);
    if (!view) return out;
    const act = deps.activationFor ?? ((p: PrismaClient, k: string, x: { from: string; to: string; houses?: number[]; maxLevel?: 1 | 2 | 3 }) => activationFor(p, k, x));
    const span = activationSpan(q.asOf);
    const [running, transit] = await Promise.all([act(deps.prisma, q.kundliId, { from: q.asOf, to: q.asOf, maxLevel: 3 }), (deps.loadTransit ?? defaultLoadTransit)(deps.prisma, q.kundliId, q.asOf)]);
    await Promise.all(q.boards.map(async (board) => {
      try {
        const activation = await act(deps.prisma, q.kundliId, { ...span, houses: BOARD_CONFIG[board].houses, maxLevel: 2 });
        let careerMap: CareerMap | null = null;
        if (board === 'work') {
          careerMap = deps.loadCareerMap
            ? await deps.loadCareerMap(deps.prisma, q.kundliId)
            : (((await latestReadyBuild(deps.prisma as never, q.kundliId, 'career').catch(() => null)) as { result?: unknown } | null)?.result as CareerMap | undefined) ?? null;
        }
        out[board] = renderBoardTechniques(board, { view, asOf: q.asOf, activation, running, transit, ageYears: q.ageYears, range: q.range, careerMap, systems: q.systems });
      } catch (e) {
        console.warn(JSON.stringify({ msg: 'board techniques failed', board, error: String((e as Error)?.message ?? e).slice(0, 200) }));
      }
    }));
  } catch (e) {
    console.warn(JSON.stringify({ msg: 'board techniques not loaded', error: String((e as Error)?.message ?? e).slice(0, 200) }));
  }
  return out;
}
