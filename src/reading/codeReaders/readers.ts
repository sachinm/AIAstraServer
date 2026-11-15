/**
 * The deterministic readers of the General Reading (docs/reading-engine/53 §4.4, step 5; 54 §5): code, no model. Each
 * reads the `digest` section of a subject's evidence pack (packs/digestSource.ts) and returns findings.v2 claims whose
 * evidence ids are paths into that section (`digest.house.D9.h7.lordDignity`), so the grounding gate of reconcile and of
 * the oracle brief checks them like any reader's. Side and weight come from the rule table (rules.ts). At most eight
 * claims each.
 *
 *   varga_dynamics  D1 ↔ frame varga: the frame house lords' dignity in both, occupants repeated in both
 *   strength_yoga   present yogas and doshas touching the frame; SAV of the frame houses; shadbala of the frame lords
 *   jaimini         chara karakas and arudhas of the frame by house class; argala on the frame houses
 *   person          the person's house in D1 and the relationship varga, and the karaka's card
 *
 * Nothing here derives astrology: it compares engine labels and numbers with the stated rules.
 */
import type { PrismaClient } from '@prisma/client';
import { getRetrogradeScoreWeights } from '../../config/env.js';
import { withTechniqueOutput } from '../../techniques/outputStore.js';
import { evaluateVakraDignityRegime, isTrueVakraCapable } from '../dasha/retrogradeRules.js';
import { resolveEvidence, type EvidencePack } from '../packs/selector.js';
import type { DigestPackSection } from '../packs/digestSource.js';
import type { Finding } from '../nodes/specialists.js';
import type { ReaderOutput } from '../oracle/runReader.js';
import type { SubjectId } from '../packs/frames.js';
import { CODE_READER_RULES, dignityClass, houseClassOf, MAX_CODE_CLAIMS, SAV_HIGH, SAV_LOW, scoreOf, verdictOf, type CodeReaderRuleId, type Polarity } from './rules.js';

export const CODE_ANALYSTS = ['varga_dynamics', 'strength_yoga', 'jaimini', 'person'] as const;
export type CodeAnalyst = (typeof CODE_ANALYSTS)[number];

/** The catalogue technique of each deterministic reader (src/techniques/catalog.ts). */
export const CODE_ANALYST_TECHNIQUE: Record<CodeAnalyst, string> = {
  varga_dynamics: 'general.varga_dynamics',
  strength_yoga: 'general.strength_yoga',
  jaimini: 'general.jaimini',
  person: 'general.person',
};

export const CODE_ANALYST_LABEL: Record<CodeAnalyst, string> = {
  varga_dynamics: 'Divisional chart agreement',
  strength_yoga: 'Strength and yogas',
  jaimini: 'Karakas, arudhas and argala',
  person: 'The person in your chart',
};

export type About = 'self' | 'mother' | 'father' | 'parent' | 'spouse' | 'child' | 'sibling' | 'other';
export type Kind = 'bond' | 'holds' | 'blocks' | 'gives' | 'window' | 'form' | 'grace';

export interface CodeClaim {
  text: string;
  evidence: string[];
  polarity: Polarity;
  weight: number;
  tradition: 'parashara' | 'jaimini';
  about: About;
  topic: string;
  kind: Kind;
  /** the rule that set side and weight */
  rule: CodeReaderRuleId;
}

export interface CodeFinding {
  analyst: CodeAnalyst;
  subject: SubjectId;
  verdict: 'strong' | 'moderate' | 'weak' | 'mixed';
  layerScore: number;
  claims: CodeClaim[];
  caveats: string[];
}

const claim = (rule: CodeReaderRuleId, text: string, evidence: string[], extra: { tradition?: CodeClaim['tradition']; about?: About; topic: string; kind?: Kind }): CodeClaim => {
  const r = CODE_READER_RULES[rule];
  return {
    text: text.slice(0, 200),
    evidence,
    polarity: r.polarity,
    weight: r.weight,
    tradition: extra.tradition ?? 'parashara',
    about: extra.about ?? 'self',
    topic: extra.topic.slice(0, 40),
    kind: extra.kind ?? (r.polarity === 'supports' ? 'holds' : r.polarity === 'obstructs' ? 'blocks' : 'gives'),
    rule,
  };
};

/** Heaviest first, then supports, obstructs, neutral; the order the rules ran keeps ties stable. */
function top(claims: CodeClaim[]): CodeClaim[] {
  const side = { supports: 0, obstructs: 1, neutral: 2 } as const;
  return claims
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.weight - a.c.weight || side[a.c.polarity] - side[b.c.polarity] || a.i - b.i)
    .slice(0, MAX_CODE_CLAIMS)
    .map((x) => x.c);
}

const finish = (analyst: CodeAnalyst, subject: SubjectId, claims: CodeClaim[], caveats: string[] = []): CodeFinding => {
  const kept = top(claims);
  const layerScore = scoreOf(kept);
  return { analyst, subject, verdict: verdictOf(layerScore, kept.length), layerScore, claims: kept, caveats };
};

const dignityRule = (label: string | null | undefined): CodeReaderRuleId | null => {
  const k = dignityClass(label);
  return k === 'strong' ? 'dignity_strong' : k === 'weak' ? 'dignity_weak' : null;
};

const sectionOf = (pack: EvidencePack): DigestPackSection | null => (pack.sections as { digest?: DigestPackSection }).digest ?? null;
const existingEvidence = (pack: EvidencePack, ids: readonly string[]): string[] =>
  ids.filter((id) => Boolean(id) && resolveEvidence(pack, id) !== undefined);

// ---------------------------------------------------------------- varga dynamics

export function vargaDynamics(pack: EvidencePack): CodeFinding {
  const d = sectionOf(pack);
  const out: CodeClaim[] = [];
  if (!d) return finish('varga_dynamics', pack.subject, out, ['no digest']);
  for (const v of d.vargas.filter((x) => x !== 'D1')) {
    for (const h of pack.keyFrame.houses) {
      const d1 = d.house.D1?.[`h${h}`];
      if (!d1?.lord) continue;
      const lord = d1.lord;
      const inD1 = d.planet.D1?.[lord];
      const inV = d.planet[v]?.[lord];
      const d9Card = v === 'D9' ? inV : d.planet.D9?.[lord];
      const vakra = evaluateVakraDignityRegime(lord, inD1, d9Card);
      const k1 = dignityClass(inD1?.dignity ?? d1.lordDignity);
      const kv = dignityClass(inV?.dignity);
      const ev1 = inD1 ? `digest.planet.D1.${lord}.dignity` : `digest.house.D1.h${h}.lordDignity`;
      const evv = `digest.planet.${v}.${lord}.dignity`;
      const sameSignD9 = Boolean(v === 'D9' && inD1?.sign && inV?.sign && inD1.sign === inV.sign);
      const isNeechaVargottama = Boolean(inV && (vakra.isNeechaVargottama || (sameSignD9 && k1 === 'weak' && kv === 'weak')));

      // CRITICAL: check Neecha Vargottama BEFORE any Vargottama boost — never invert Neecha Vargottama into strength.
      if (inV && isNeechaVargottama) {
        const nvEv = existingEvidence(pack, [
          ev1,
          evv,
          `digest.planet.D1.${lord}.sign`,
          `digest.planet.${v}.${lord}.sign`,
          ...(inD1?.retro === true ? [`digest.planet.D1.${lord}.retro`] : []),
        ]);
        if (nvEv.length > 0) {
          out.push(
            claim(
              'varga_agree_weak',
              `House ${h} lord ${lord} is debilitated in the same sign across D1 and D9 (Neecha Vargottama)${inD1?.retro ? ' while retrograde' : ''}: fixed Drudha Karma boundary, never inverted into strength.`,
              nvEv,
              { topic: `house ${h}` },
            ),
          );
        }
      } else if (inV && sameSignD9 && k1 !== 'weak' && kv !== 'weak') {
        if (k1 === 'strong' && kv === 'strong') {
          out.push(
            claim(
              'varga_agree_strong',
              `House ${h} lord ${lord} is ${inD1?.dignity ?? d1.lordDignity} in D1 and ${inV.dignity} in ${v}: the ${v} confirms the D1 promise.`,
              [ev1, evv],
              { topic: `house ${h}` },
            ),
          );
        } else {
          const vgEv = existingEvidence(pack, [
            `digest.planet.D1.${lord}.sign`,
            `digest.planet.${v}.${lord}.sign`,
            ev1,
            evv,
          ]);
          if (vgEv.length > 0) {
            out.push(
              claim(
                'varga_agree_strong',
                `House ${h} lord ${lord} holds Vargottama sign ${inD1?.sign} across D1 and D9 without debility: inner and outer promise align.`,
                vgEv,
                { topic: `house ${h}` },
              ),
            );
          }
        }
      } else if (inV && k1 !== 'other' && k1 === kv) {
        out.push(claim(k1 === 'strong' ? 'varga_agree_strong' : 'varga_agree_weak', `House ${h} lord ${lord} is ${inD1?.dignity ?? d1.lordDignity} in D1 and ${inV.dignity} in ${v}: the ${v} ${k1 === 'strong' ? 'confirms' : 'repeats the weakness of'} the D1 promise.`, [ev1, evv], { topic: `house ${h}` }));
      } else if (inV && k1 !== 'other' && kv !== 'other' && k1 !== kv) {
        out.push(claim('varga_disagree', `House ${h} lord ${lord} is ${inD1?.dignity ?? d1.lordDignity} in D1 but ${inV.dignity} in ${v}: promise and form disagree.`, [ev1, evv], { topic: `house ${h}`, kind: 'form' }));
      }

      if (
        inV &&
        !isNeechaVargottama &&
        (inV.vargaReckoning === 'inverse_vakra' ||
          inV.vargaSandhi === true ||
          (inD1?.retro === true && isTrueVakraCapable(lord)) ||
          (inV.retro === true && isTrueVakraCapable(lord)))
      ) {
        const motionEv = existingEvidence(pack, [
          ...(inD1?.retro !== undefined ? [`digest.planet.D1.${lord}.retro`] : []),
          ...(inV.retro !== undefined ? [`digest.planet.${v}.${lord}.retro`] : []),
          ...(inV.vargaReckoning !== undefined ? [`digest.planet.${v}.${lord}.vargaReckoning`] : []),
          ...(inV.vargaSandhi !== undefined ? [`digest.planet.${v}.${lord}.vargaSandhi`] : []),
        ]);
        if (motionEv.length > 0) {
          const detailParts = [
            inV.vargaReckoning ? `reckoning=${inV.vargaReckoning}` : null,
            inV.vargaSandhi ? 'vargaSandhi' : null,
            vakra.effectiveRegime !== 'direct' ? vakra.effectiveRegime : 'retrograde',
          ].filter(Boolean);
          out.push(
            claim(
              'varga_disagree',
              `House ${h} lord ${lord} carries divisional retrograde motion across D1/${v} (${detailParts.join(', ')}): delivery unfolds iteratively.`,
              motionEv,
              { topic: `house ${h}`, kind: 'form' },
            ),
          );
        }
      }

      const vh = d.house[v]?.[`h${h}`];
      const d1occ = new Set((d1.occupants ?? []).map((o) => o.planet));
      for (const o of vh?.occupants ?? []) {
        if (d1occ.has(o.planet)) out.push(claim('varga_occupant_repeats', `${o.planet} occupies house ${h} in both D1 and ${v}.`, [`digest.house.D1.h${h}.occupants`, `digest.house.${v}.h${h}.occupants`], { topic: o.planet, kind: 'bond' }));
      }
    }
  }
  return finish('varga_dynamics', pack.subject, out, d.vargas.length > 1 ? [] : ["the frame's varga is not in the digest"]);
}

// ---------------------------------------------------------------- strength and yogas

export function strengthYoga(pack: EvidencePack): CodeFinding {
  const d = sectionOf(pack);
  const out: CodeClaim[] = [];
  if (!d) return finish('strength_yoga', pack.subject, out, ['no digest']);
  const weights = getRetrogradeScoreWeights();
  for (const [key, y] of Object.entries(d.yoga.D1 ?? {})) {
    const dosha = /dosha/i.test(y.class);
    const joins = [...y.planets, ...y.houses.map((h) => `house ${h}`)].join(', ');
    out.push(claim(dosha ? 'dosha_present' : 'yoga_present', `${y.name} (${y.class}) is present${joins ? `, joining ${joins}` : ''}.`, [`digest.yoga.D1.${key}.name`], { topic: y.name, kind: dosha ? 'blocks' : 'grace' }));
  }
  for (const h of pack.keyFrame.houses) {
    const sav = d.house.D1?.[`h${h}`]?.sav;
    if (typeof sav !== 'number') continue;
    if (sav >= SAV_HIGH) out.push(claim('sav_high', `House ${h} holds ${sav} ashtakavarga bindus (${SAV_HIGH} or more).`, [`digest.house.D1.h${h}.sav`], { topic: `house ${h}` }));
    else if (sav <= SAV_LOW) out.push(claim('sav_low', `House ${h} holds only ${sav} ashtakavarga bindus (${SAV_LOW} or fewer).`, [`digest.house.D1.h${h}.sav`], { topic: `house ${h}` }));
  }
  for (const lord of pack.keyFrame.lords) {
    const p = d.planet.D1?.[lord];
    if (!p || typeof p.shadbalaRatio !== 'number') continue;
    const rank = typeof p.shadbalaRank === 'number' ? `, rank ${p.shadbalaRank}` : '';
    const ev = [`digest.planet.D1.${lord}.shadbalaRatio`, ...(rank ? [`digest.planet.D1.${lord}.shadbalaRank`] : [])];
    out.push(claim(p.shadbalaRatio >= 1 ? 'shadbala_enough' : 'shadbala_short', `${lord}, a frame lord, has shadbala ratio ${p.shadbalaRatio}${rank}: ${p.shadbalaRatio >= 1 ? 'enough' : 'short of the'} required strength.`, ev, { topic: lord }));
  }
  const frameBodies = [...new Set([...pack.keyFrame.lords, ...(pack.keyFrame.karakas ?? [])])];
  for (const body of frameBodies) {
    const p = d.planet.D1?.[body];
    if (!p) continue;
    const vakra = evaluateVakraDignityRegime(body, p, d.planet.D9?.[body]);
    const hasStrongCheshta = isTrueVakraCapable(body) && typeof p.cheshtaBala === 'number' && p.cheshtaBala >= weights.cheshtaStrongVirupas;
    if (p.isStationary === true) {
      const ev = existingEvidence(pack, [
        `digest.planet.D1.${body}.isStationary`,
        ...(p.motionState !== undefined ? [`digest.planet.D1.${body}.motionState`] : []),
        ...(p.retro !== undefined ? [`digest.planet.D1.${body}.retro`] : []),
      ]);
      if (ev.length > 0) {
        out.push(
          claim(
            'shadbala_short',
            `${body} is stationary (vikala) in D1: sharp turning-point intensity calling for deliberate verification.`,
            ev,
            { topic: body, kind: 'window' },
          ),
        );
      }
    } else if (p.retro === true && isTrueVakraCapable(body)) {
      const ev = existingEvidence(pack, [
        `digest.planet.D1.${body}.retro`,
        ...(typeof p.cheshtaBala === 'number' ? [`digest.planet.D1.${body}.cheshtaBala`] : []),
        ...(p.motionState !== undefined ? [`digest.planet.D1.${body}.motionState`] : []),
      ]);
      if (ev.length > 0) {
        if (vakra.isNeechaVargottama) {
          out.push(
            claim(
              'dignity_weak',
              `${body} is retrograde in Neecha Vargottama: fixed Drudha Karma boundary, never inverted into strength.`,
              ev,
              { topic: body },
            ),
          );
        } else if (hasStrongCheshta) {
          out.push(
            claim(
              'shadbala_enough',
              `${body} is retrograde (${p.motionState ?? 'vakra'}) with high cheshtaBala ${p.cheshtaBala}: sustained second-pass effort (${vakra.effectiveRegime}).`,
              ev,
              { topic: body },
            ),
          );
        } else {
          out.push(
            claim(
              'varga_disagree',
              `${body} is retrograde (${p.motionState ?? 'vakra'}) in D1 (${vakra.effectiveRegime}): outcomes mature through iterative revision.`,
              ev,
              { topic: body, kind: 'form' },
            ),
          );
        }
      }
    } else if (hasStrongCheshta) {
      const ev = existingEvidence(pack, [`digest.planet.D1.${body}.cheshtaBala`]);
      if (ev.length > 0) {
        out.push(
          claim(
            'shadbala_enough',
            `${body} carries elevated cheshtaBala (${p.cheshtaBala}): high motional effort on frame significations.`,
            ev,
            { topic: body },
          ),
        );
      }
    }
  }
  for (const [ak, row] of Object.entries(d.annual ?? {})) {
    if (row.kind === 'TP' && row.varga === 'D1' && row.yearLordRetro === true) {
      const ev = existingEvidence(pack, [
        `digest.annual.${ak}.yearLordRetro`,
        ...(row.yearLord !== undefined ? [`digest.annual.${ak}.yearLord`] : []),
      ]);
      if (ev.length > 0) {
        out.push(
          claim(
            'varga_disagree',
            `Tithi Pravesha ${row.year} year lord ${row.yearLord ?? ''} is retrograde: annual progress favors iterative review and renegotiation.`,
            ev,
            { topic: `TP ${row.year}`, kind: 'window' },
          ),
        );
      }
    }
  }
  return finish('strength_yoga', pack.subject, out);
}

// ---------------------------------------------------------------- jaimini

export function jaimini(pack: EvidencePack): CodeFinding {
  const d = sectionOf(pack);
  const out: CodeClaim[] = [];
  if (!d) return finish('jaimini', pack.subject, out, ['no digest']);
  const frameHouses = pack.keyFrame.houses;
  for (const [key, p] of Object.entries(d.point.D1 ?? {})) {
    if (p.house === null || p.house === undefined) continue;
    const card = d.house.D1?.[`h${p.house}`];
    const k = houseClassOf(card?.class);
    const inFrame = frameHouses.includes(p.house);
    if (k === 'other' && !inFrame) continue;
    const ev = [`digest.point.D1.${key}.house`, ...(card ? [`digest.house.D1.h${p.house}.class`] : [])];
    if (k === 'good') out.push(claim('house_class_good', `${p.id} sits in house ${p.house} (${(card?.class ?? []).join(', ')})${inFrame ? ', a frame house' : ''}.`, ev, { tradition: 'jaimini', topic: p.id }));
    else if (k === 'hard') out.push(claim('house_class_hard', `${p.id} sits in house ${p.house} (${(card?.class ?? []).join(', ')})${inFrame ? ', a frame house' : ''}.`, ev, { tradition: 'jaimini', topic: p.id }));
  }
  for (const h of frameHouses) {
    const a = d.house.D1?.[`h${h}`]?.argala;
    if (!a || a.primary.length === 0) continue;
    const ev = [`digest.house.D1.h${h}.argala`];
    if (a.primary.length > a.obstructed.length) out.push(claim('argala_holds', `House ${h} has argala from ${a.primary.join(', ')}${a.obstructed.length ? `, obstructed only by ${a.obstructed.join(', ')}` : ', unobstructed'}.`, ev, { tradition: 'jaimini', topic: `house ${h}` }));
    else out.push(claim('argala_blocked', `House ${h} has argala from ${a.primary.join(', ')}, obstructed by ${a.obstructed.join(', ')}.`, ev, { tradition: 'jaimini', topic: `house ${h}` }));
  }
  for (const [key, rp] of Object.entries(d.rasi ?? {})) {
    const ev = [`digest.rasi.${key}.sign`];
    out.push(claim('rasi_period_active', `${rp.system === 'chara' ? 'Chara' : 'Narayana'} rasi period ${rp.sign} (${rp.from} to ${rp.to}) activates house ${rp.houses.join(', ')}.`, ev, { tradition: 'jaimini', topic: `house ${rp.houses[0]}`, kind: 'window' }));
  }
  return finish('jaimini', pack.subject, out);
}

// ---------------------------------------------------------------- the person

export function personReader(pack: EvidencePack): CodeFinding {
  const d = sectionOf(pack);
  const out: CodeClaim[] = [];
  if (!d?.person) return finish('person', pack.subject, out, [d ? 'no person in the question or the subject' : 'no digest']);
  const { who, houses, varga, karaka } = d.person;
  const about = who as About;
  for (const h of houses) {
    for (const v of ['D1', varga]) {
      const card = d.house[v]?.[`h${h}`];
      if (!card?.lord) continue;
      const own = d.planet[v]?.[card.lord]?.dignity;
      const label = own ?? card.lordDignity;
      const rule = dignityRule(label);
      const ev = own ? `digest.planet.${v}.${card.lord}.dignity` : `digest.house.${v}.h${h}.lordDignity`;
      if (rule) out.push(claim(rule, `The ${who}'s house ${h} in ${v}: its lord ${card.lord} is ${label}.`, [ev], { about, topic: `${who} house ${h}` }));
      const lordCard = d.planet[v]?.[card.lord];
      if (lordCard && (lordCard.retro === true || lordCard.isStationary === true) && isTrueVakraCapable(card.lord)) {
        const motionEv = existingEvidence(pack, [
          ...(lordCard.retro !== undefined ? [`digest.planet.${v}.${card.lord}.retro`] : []),
          ...(lordCard.isStationary !== undefined ? [`digest.planet.${v}.${card.lord}.isStationary`] : []),
          ...(typeof lordCard.cheshtaBala === 'number' ? [`digest.planet.${v}.${card.lord}.cheshtaBala`] : []),
        ]);
        if (motionEv.length > 0) {
          out.push(
            claim(
              'varga_disagree',
              `The ${who}'s house ${h} lord ${card.lord} is ${lordCard.isStationary ? 'stationary' : 'retrograde'} in ${v}: bonds and expectations mature through repeated dialogue.`,
              motionEv,
              { about, topic: `${who} house ${h}`, kind: 'bond' },
            ),
          );
        }
      }
      for (const o of card.occupants ?? []) {
        const r = dignityRule(o.dignity);
        if (r) out.push(claim(r, `${o.planet} in the ${who}'s house ${h} of ${v} is ${o.dignity}.`, [`digest.house.${v}.h${h}.occupants`], { about, topic: o.planet }));
      }
    }
    const sav = d.house.D1?.[`h${h}`]?.sav;
    if (typeof sav === 'number' && (sav >= SAV_HIGH || sav <= SAV_LOW)) out.push(claim(sav >= SAV_HIGH ? 'sav_high' : 'sav_low', `The ${who}'s house ${h} holds ${sav} ashtakavarga bindus.`, [`digest.house.D1.h${h}.sav`], { about, topic: `${who} house ${h}` }));
  }
  for (const v of ['D1', varga]) {
    const p = d.planet[v]?.[karaka];
    const rule = dignityRule(p?.dignity);
    if (p && rule) out.push(claim(rule, `${karaka}, the natural significator of the ${who}, is ${p.dignity} in ${v}${p.house ? ` (house ${p.house})` : ''}.`, [`digest.planet.${v}.${karaka}.dignity`], { about, topic: karaka }));
    if (p && (p.retro === true || p.isStationary === true) && isTrueVakraCapable(karaka)) {
      const karakaEv = existingEvidence(pack, [
        ...(p.retro !== undefined ? [`digest.planet.${v}.${karaka}.retro`] : []),
        ...(p.isStationary !== undefined ? [`digest.planet.${v}.${karaka}.isStationary`] : []),
        ...(typeof p.cheshtaBala === 'number' ? [`digest.planet.${v}.${karaka}.cheshtaBala`] : []),
      ]);
      if (karakaEv.length > 0) {
        out.push(
          claim(
            'varga_disagree',
            `${karaka}, significator of the ${who}, is ${p.isStationary ? 'stationary' : 'retrograde'} in ${v}: care and communication deepen on a second pass.`,
            karakaEv,
            { about, topic: karaka, kind: 'bond' },
          ),
        );
      }
    }
  }
  return finish('person', pack.subject, out);
}

export const CODE_READERS: Record<CodeAnalyst, (pack: EvidencePack) => CodeFinding> = {
  varga_dynamics: vargaDynamics,
  strength_yoga: strengthYoga,
  jaimini,
  person: personReader,
};

const CODE_READER_MEMO_MAX = 256;
const codeReaderMemo = new Map<string, CodeFinding[]>();

export function clearCodeReaderMemo(): void {
  codeReaderMemo.clear();
}

/** Evicts in-memory deterministic code-reader findings belonging to a kundli (45-minute individual cache recycle). */
export function evictCodeReaderMemoForIndividual(kundliId: string | null | undefined): number {
  if (!kundliId) return 0;
  const needle = `"k":${JSON.stringify(kundliId)}`;
  let deleted = 0;
  for (const k of codeReaderMemo.keys()) {
    if (k.includes(needle)) {
      codeReaderMemo.delete(k);
      deleted += 1;
    }
  }
  return deleted;
}

/** Runs the named deterministic readers on one subject's pack. A pack without a digest section gives nothing. */
export function runCodeReaders(
  pack: EvidencePack,
  analysts: readonly CodeAnalyst[],
  cacheContext?: { kundliId?: string | null; facts?: Record<string, string> | null; slotPerson?: string | null },
): CodeFinding[] {
  const d = sectionOf(pack);
  if (!d) return [];
  const key = JSON.stringify({
    v: d.version,
    k: cacheContext?.kundliId ?? '',
    s: pack.subject,
    a: analysts,
    p: d.person?.who ?? cacheContext?.slotPerson ?? '',
    f: cacheContext?.facts ?? {},
    h: pack.keyFrame.houses,
    rasi: Object.keys(d.rasi ?? {}),
    yogas: Object.keys(d.yoga.D1 ?? {}),
  });
  const hit = codeReaderMemo.get(key);
  if (hit && cacheContext?.kundliId) return hit;
  const out = analysts.map((a) => CODE_READERS[a](pack));
  if (cacheContext?.kundliId) {
    if (codeReaderMemo.size >= CODE_READER_MEMO_MAX) {
      const oldest = codeReaderMemo.keys().next().value;
      if (oldest !== undefined) codeReaderMemo.delete(oldest);
    }
    codeReaderMemo.set(key, out);
  }
  return out;
}

/**
 * Runs the named deterministic readers through `withTechniqueOutput` (docs/reading-engine/56 §4.1), caching each
 * natal reader's `CodeFinding` per `(kundliId, digestVersion, subject)` until the digest version changes.
 */
export async function runCodeReadersCached(
  prisma: PrismaClient,
  pack: EvidencePack,
  analysts: readonly CodeAnalyst[],
  opts: {
    kundliId: string;
    digestVersion: string;
    userId?: string | null;
    now?: Date;
    facts?: Record<string, string> | null;
    slotPerson?: string | null;
  },
): Promise<CodeFinding[]> {
  const d = sectionOf(pack);
  if (!d) return [];
  const now = opts.now ?? new Date();
  const packScope = [
    opts.digestVersion,
    pack.subject,
    d.person?.who ?? opts.slotPerson ?? '',
    pack.keyFrame.houses.join(','),
    Object.keys(d.rasi ?? {}).sort().join(','),
  ].join(':');
  const out = await Promise.all(
    analysts.map(async (analyst) => {
      const res = await withTechniqueOutput(
        prisma,
        {
          technique: CODE_ANALYST_TECHNIQUE[analyst],
          kundliId: opts.kundliId,
          digestVersion: packScope,
          context: { now },
          userId: opts.userId ?? null,
          subject: pack.subject,
        },
        async () => CODE_READERS[analyst](pack),
      );
      return res.value;
    }),
  );
  if (opts.kundliId) {
    const key = JSON.stringify({
      v: d.version,
      k: opts.kundliId,
      s: pack.subject,
      a: analysts,
      p: d.person?.who ?? opts.slotPerson ?? '',
      f: opts.facts ?? {},
      h: pack.keyFrame.houses,
      rasi: Object.keys(d.rasi ?? {}),
      yogas: Object.keys(d.yoga.D1 ?? {}),
    });
    if (codeReaderMemo.size >= CODE_READER_MEMO_MAX) {
      const oldest = codeReaderMemo.keys().next().value;
      if (oldest !== undefined) codeReaderMemo.delete(oldest);
    }
    codeReaderMemo.set(key, out);
  }
  return out;
}

/** The same finding in the shape the oracle brief reads (oracle/runReader.ts ReaderOutput); yogas that hold go to graces. */
export function toReaderOutput(f: CodeFinding): ReaderOutput {
  return {
    verdict: f.verdict,
    layerScore: f.layerScore,
    digest: '',
    claims: f.claims.map((c) => ({ text: c.text, evidence: c.evidence, polarity: c.polarity, weight: c.weight, tradition: c.tradition, about: c.about, topic: c.topic, kind: c.kind })),
    windows: [],
    quotes: [],
    gaps: [],
    disagree: '',
    actors: [],
    graces: f.claims.filter((c) => c.kind === 'grace').map((c) => ({ text: c.text, evidence: c.evidence })),
    pointers: [],
    sensitive: '',
    form: '',
    culprits: [],
    contributors: [],
    caveats: f.caveats,
  };
}

/** The same finding in the shape reconcile and the graph brief read. */
export function toFinding(f: CodeFinding): Finding {
  return {
    analyst: f.analyst,
    subject: f.subject,
    verdict: f.verdict,
    layerScore: f.layerScore,
    status: 'ok',
    claims: f.claims.map((c) => ({ text: c.text, evidence: c.evidence, polarity: c.polarity, weight: c.weight, tradition: c.tradition })),
    windows: [],
    caveats: f.caveats,
    keyFacts: [],
  };
}
