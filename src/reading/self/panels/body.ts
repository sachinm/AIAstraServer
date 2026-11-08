/**
 * `self.reading.body` — Your body, mind, brain, food intake, and physical constitution across:
 *   1. All 12 natal houses (`H1..H12`): head/brain/nerves (`H1, H3, H5`), food intake/neck/throat/face (`H2`),
 *      hands/arms/shoulders/collarbone (`H3`), heart/chest/lungs/emotional mind (`H4`), stomach/upper digestion (`H5`),
 *      internal organs/intestines/liver/weight balance/daily wear (`H6`), deep cellular recovery & pelvic reserves (`H8`),
 *      blood flow & arterial/venous circulation (`Ma, Su, Mo`), hips/thighs (`H9`), knees/skeletal joints (`H10`),
 *      legs/calves/ankles (`H11`), and feet/lymphatic drainage/sleep (`H12`).
 *   2. Divisional Vargas (`D1, D9, D30, D60`) & Chara Karakas (`AK`, `Karakamsa`): connecting physical body, thinking brain (`Me`),
 *      emotional mind (`Mo`), and soul (`Su, AK`).
 *   3. Multi-Clock Dasha Synthesis: primary reading clock (`dwisatpathi` / conditional) alongside `vimsottari` and Jaimini `narayana`.
 *   4. Multi-Year Tithi Pravesha & Varshaphal (`2025`, `2026`, `2027` across `D1..D60`) plus `tithi_ashtottari` and `mudda` annual dashas.
 *   5. Universal Shared Transit Sky (`sky` / Gochara) & Sarvashtakavarga (`SAV`) bindus over Lagna, Moon, and body houses.
 */
import type { TransitRangePayload } from '../../chartData/transitRange.js';
import { BODY_NOTE, BODY_SHAPE, clockLabel, dignityWords, HOUSE_SELF, HOUSE_SHORT, longDate, PLANET_FACULTY, PLANET_SHORT, RIPENESS_WORDS } from '../words.js';
import { activationKey, allRunningDashas, gaps, houseFrame, planetChain, pointOf, runningChain } from '../slices.js';
import type { PanelBody, SelfClaim } from '../types.js';
import { activeTpAshtottariPeriod } from './year.js';
import { body, cap, cardDetail, pname, type PanelInput } from './common.js';

export const BODY_HOUSES = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

export interface BodyPanelOptions {
  sensitive?: boolean;
  skyStored?: boolean;
  sky?: TransitRangePayload | null;
}

export function bodyPanel({ view, activation, asOf, clock }: PanelInput, opts: BodyPanelOptions = {}): PanelBody & { note: string } {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const h1 = houseFrame(view, 'D1', 1, g);
  const L = planetChain(view, h1?.lord, g);
  if (!h1 || !L) return { ...body('', [], g), note: BODY_NOTE };

  const su = planetChain(view, 'Su', g);
  const mo = view.planet('D1', 'Mo');
  const me = view.planet('D1', 'Me');
  const ma = view.planet('D1', 'Ma');
  const ju = view.planet('D1', 'Ju');
  const ve = view.planet('D1', 'Ve');
  const sa = view.planet('D1', 'Sa');
  const d60L = view.planet('D60', L.planet);

  // 1. Core Constitution, Head, Cranium & Vitality (`body.footing`, H1, Lagna Lord, Sun, D1/D9/D60)
  const lw = dignityWords(L.d1.dignity);
  const sw = su ? dignityWords(su.d1.dignity) : null;
  const ripeness = L.d1.avasthaMultipliers?.ripeness ? RIPENESS_WORDS[L.d1.avasthaMultipliers.ripeness] : null;
  if (lw) {
    const line = `Your body's footing rests on a ruler that is ${lw} where it sits${sw ? `; your vitality is ${sw}` : ''}.`;
    const fullText = `${line} Your physical constitution, head, and cranial vitality are anchored in ${HOUSE_SELF[L.d1.house ?? 1] ?? 'your partnerships and outer commitments'}${ripeness ? `, where your primary vitality ruler ${ripeness}` : ''}${L.d9?.sign ? ` and holds ${dignityWords(L.d9.dignity) ?? 'steady'} standing in the inner chart` : ''}${d60L?.sign ? ` with deep root resilience in the root chart (${d60L.sign})` : ''}.`;
    claims.push({
      id: 'body.footing',
      text: fullText,
      detail: `Lagna ${h1.sign}; lagna lord ${cardDetail(L.d1)}${L.d9 ? `; D9 ${L.d9.sign} (${L.d9.dignity ?? '?'})` : ''}${d60L ? `; D60 ${d60L.sign} (${d60L.dignity ?? '?'})` : ''}${su ? `; Sun ${cardDetail(su.d1)}` : ''}`,
      certainty: 'fact',
      evidence: ['house:D1.h1', ...L.evidence, ...(su ? su.evidence.slice(0, 1) : []), ...(d60L ? [`planet:D60.${L.planet}`] : [])],
      range: 'always',
    });
  }

  // 2. Self = Body + Mind + Brain + Soul (`body.head_brain_mind`, H1, H4, H5, Mo, Me, Su, AK)
  const h4 = houseFrame(view, 'D1', 4, g);
  const h5 = houseFrame(view, 'D1', 5, g);
  const ak = pointOf(view, 'D1', 'AK', g);
  const kl = pointOf(view, 'D9', 'KL', g);
  if (mo || me) {
    const moWords = mo ? dignityWords(mo.dignity) ?? 'sensitive' : 'sensitive';
    const meWords = me ? dignityWords(me.dignity) ?? 'active' : 'active';
    const cancel = view.yogas().find((y) => /cancel/i.test(y.class) && y.planets.includes('Mo'));
    const brainMindText = `In the holistic Self—where body, brain, emotional mind, and soul operate as one system—your cognitive brain and neural processing (${PLANET_FACULTY.Me}) sit ${meWords} in ${HOUSE_SELF[me?.house ?? 1] ?? 'deep research and problem-solving'}, while your emotional mind and autonomic nervous balance (${PLANET_FACULTY.Mo}) sit ${moWords} in ${HOUSE_SELF[mo?.house ?? 1] ?? 'higher meaning'}${cancel ? ', lifted over time by a protective cancellation when emotional pressure spikes' : ''}${ak?.planet ? `, aligned with a soul aim (${PLANET_FACULTY[ak.planet] ?? 'purpose'}) that drives mental intensity` : ''}.`;
    claims.push({
      id: 'body.head_brain_mind',
      text: brainMindText,
      detail: `Brain/nerves Me: ${me ? cardDetail(me) : 'n/a'}; Mind/autonomic Mo: ${mo ? cardDetail(mo) : 'n/a'}${cancel ? ` (${cancel.name})` : ''}; H5 cognitive ${h5?.sign ?? '?'} (lord ${pname(h5?.lord)}); Soul AK ${pname(ak?.planet)}${kl?.sign ? `, Karakamsa D9 ${kl.sign}` : ''}`,
      certainty: 'fact',
      evidence: [
        'house:D1.h1',
        ...(mo ? ['planet:D1.Mo'] : []),
        ...(me ? ['planet:D1.Me'] : []),
        ...(h5 ? ['house:D1.h5'] : []),
        ...(ak ? ['point:D1.AK'] : []),
        ...(cancel ? [`yoga:D1.${cancel.id}`] : []),
      ],
      range: 'always',
    });
  }

  // 3. Food Intake (Ahara), Diet, Neck, Throat & Face (`body.food_neck`, H2, 2nd Lord, Ve, Ju)
  const h2 = houseFrame(view, 'D1', 2, g);
  if (h2) {
    const l2Card = h2.lord ? view.planet('D1', h2.lord) : null;
    const h2Occ = h2.occupants.map((o) => pname(o.planet)).join(', ');
    const foodText = `Your food intake, dietary assimilation, face, throat, and upper neck are governed by the 2nd house (${h2.sign ?? 'fire/initiative'}), whose ruler sits in ${HOUSE_SELF[h2.lordHouse ?? 1] ?? 'intensity and discipline'}${l2Card ? ` (${dignityWords(l2Card.dignity) ?? 'steady'})` : ''}: rushed meals, high-heat or irregular eating schedules when absorbed in deep work register quickly in the throat, neck, and digestive warmth, making warm, regular, nutrient-dense meals essential.`;
    claims.push({
      id: 'body.food_neck',
      text: foodText,
      detail: `D1 h2 (food intake, throat, neck, face) ${h2.sign}, lord ${pname(h2.lord)} in h${h2.lordHouse ?? '?'} (${h2.lordDignity ?? '?'}); occupants: ${h2Occ || 'none'}; aspected by: ${h2.aspectedGraha.map(pname).join(', ') || 'none'}`,
      certainty: 'fact',
      evidence: ['house:D1.h2', ...(l2Card ? [`planet:D1.${h2.lord}`] : [])],
      range: 'always',
    });
  }

  // 4. Lower Neck, Collarbone, Shoulders, Hands, Arms & Nervous Coordination (`body.hands_neck_nerves`, H3, 3rd Lord, Me, Ma)
  const h3 = houseFrame(view, 'D1', 3, g);
  if (h3) {
    const l3Card = h3.lord ? view.planet('D1', h3.lord) : null;
    const h3Occ = h3.occupants.map((o) => PLANET_FACULTY[o.planet] ?? o.planet).join(' and ');
    const handsText = `Your hands, arms, shoulders, collarbone, lower neck, and peripheral nerve pathways are shaped by the 3rd house (${h3.sign ?? 'initiative'}), whose ruler sits in ${HOUSE_SELF[h3.lordHouse ?? 3] ?? 'daily effort'}${l3Card ? ` (${dignityWords(l3Card.dignity) ?? 'active'})` : ''}${h3Occ ? ` with ${h3Occ}` : ''}: sustained manual or mental effort channels directly through the hands, wrists, shoulders, and upper spine.`;
    claims.push({
      id: 'body.hands_neck_nerves',
      text: handsText,
      detail: `D1 h3 (hands, arms, shoulders, collarbone, lower neck, nervous coordination) ${h3.sign}, lord ${pname(h3.lord)} in h${h3.lordHouse ?? '?'} (${h3.lordDignity ?? '?'}); occupants: ${h3.occupants.map((o) => pname(o.planet)).join(', ') || 'none'}`,
      certainty: 'fact',
      evidence: ['house:D1.h3', ...(l3Card ? [`planet:D1.${h3.lord}`] : [])],
      range: 'always',
    });
  }

  // 5. Heart, Chest, Lungs, Ribcage & Autonomic Peace (`body.heart_chest`, H4, 4th Lord, Su, Mo)
  if (h4) {
    const l4Card = h4.lord ? view.planet('D1', h4.lord) : null;
    const heartText = `Your heart, chest, ribcage, lungs, and cardiovascular rhythm rest on the 4th house (${h4.sign ?? 'air/circulation'}), whose ruler sits in ${HOUSE_SELF[h4.lordHouse ?? 8] ?? 'sudden change and deep concentration'}${l4Card ? ` (${dignityWords(l4Card.dignity) ?? 'steady'})` : ''} alongside solar vitality in ${HOUSE_SHORT[su?.d1.house ?? 7] ?? 'partnership'}: unexpressed emotional or work tension goes straight to chest tightness, shallow breathing, and cardiac/autonomic pacing, so aerobic breathwork and unhurried decompression directly protect the heart and chest.`;
    claims.push({
      id: 'body.heart_chest',
      text: heartText,
      detail: `D1 h4 (heart, chest, lungs) ${h4.sign}, lord ${pname(h4.lord)} in h${h4.lordHouse ?? '?'} (${h4.lordDignity ?? '?'}); aspected by ${h4.aspectedGraha.map(pname).join(', ') || 'none'}; Sun in h${su?.d1.house ?? '?'}; Moon in h${mo?.house ?? '?'}`,
      certainty: 'fact',
      evidence: ['house:D1.h4', ...(l4Card ? [`planet:D1.${h4.lord}`] : []), ...(su ? ['planet:D1.Su'] : []), ...(mo ? ['planet:D1.Mo'] : [])],
      range: 'always',
    });
  }

  // 6. Internal Organs, Stomach, Intestines, Liver/Metabolic Weight Balance & Daily Wear (`body.organs_weight` & `body.wear`, H5, H6, Ju, Sa, Me)
  const h6 = houseFrame(view, 'D1', 6, g);
  if (h6?.lordHouse) {
    const occ6 = h6.occupants.map((o) => pname(o.planet)).join(', ');
    const juRip = ju?.avasthaMultipliers?.ripeness ? RIPENESS_WORDS[ju.avasthaMultipliers.ripeness] : null;
    const wearLine = `What wears the body comes through ${HOUSE_SHORT[h6.lordHouse]}.`;
    const organsText = `${wearLine} For internal organs, digestive tract, liver/pancreatic metabolism, and weight regulation, the 6th house (${h6.sign}) puts its ruler in ${HOUSE_SELF[h6.lordHouse]} while your metabolic and hepatic regulator (${PLANET_FACULTY.Ju}) sits in ${HOUSE_SHORT[ju?.house ?? 7] ?? 'partnership'}${juRip ? ` and ${juRip}` : ''}: under sustained work stress or sedentary stretches, the body is prone to digestive sluggishness, water/weight retention around the midsection, and metabolic fatigue unless daily movement and clean hydration stay non-negotiable.`;
    claims.push({
      id: 'body.wear',
      text: organsText,
      detail: `D1 h6 (internal organs, intestines, metabolic weight, daily wear) ${h6.sign}, lord ${pname(h6.lord)} in h${h6.lordHouse} (${h6.lordDignity ?? '?'}); occupants ${occ6 || 'none'}; Ju in h${ju?.house ?? '?'} (${ju?.dignity ?? '?'});Ve in h${ve?.house ?? '?'}`,
      certainty: 'fact',
      evidence: ['house:D1.h6', ...(ju ? ['planet:D1.Ju'] : []), ...h6.occupants.map((o) => `planet:D1.${o.planet}`)],
      range: 'always',
    });
  }

  // 7. Deep Cellular Recovery, Adrenal/Endocrine Reserves & Chronic Strain (`body.renewal_pelvic`, H8, 8th Lord)
  const h8 = houseFrame(view, 'D1', 8, g);
  if (h8) {
    const l8Card = h8.lord ? view.planet('D1', h8.lord) : null;
    const occ8 = h8.occupants.map((o) => pname(o.planet)).join(', ');
    const h8Text = `Deep cellular recovery, adrenal/endocrine reserves, and eliminative balance run through the 8th house (${h8.sign ?? 'balance'}), occupied by ${h8.occupants.length ? h8.occupants.map((o) => PLANET_FACULTY[o.planet] ?? o.planet).join(' and ') : 'its ruler\'s gaze'} with its ruler in ${HOUSE_SELF[h8.lordHouse ?? 6] ?? 'service and daily grind'}: mental overexertion and irregular hours tax adrenal recovery before showing outwardly, requiring deliberate rest cycles between high-output sprints.`;
    claims.push({
      id: 'body.renewal_pelvic',
      text: h8Text,
      detail: `D1 h8 (cellular recovery, pelvic/eliminative organs, longevity reserves) ${h8.sign}, lord ${pname(h8.lord)} in h${h8.lordHouse ?? '?'} (${h8.lordDignity ?? '?'}); occupants: ${occ8 || 'none'}`,
      certainty: 'fact',
      evidence: ['house:D1.h8', ...(l8Card ? [`planet:D1.${h8.lord}`] : []), ...h8.occupants.map((o) => `planet:D1.${o.planet}`)],
      range: 'always',
    });
  }

  // 8. Blood Flow, Circulation, Hips, Thighs, Knees, Calves, Ankles & Feet (`body.blood_limbs_feet`, H9, H10, H11, H12, Ma, Mo, Sa)
  const h9 = houseFrame(view, 'D1', 9, g);
  const h10 = houseFrame(view, 'D1', 10, g);
  const h11 = houseFrame(view, 'D1', 11, g);
  const h12 = houseFrame(view, 'D1', 12, g);
  if (h9 && h10 && h11 && h12) {
    const bloodLimbsText = `Arterial blood flow and muscular oxygenation (${PLANET_FACULTY.Ma} in ${HOUSE_SHORT[ma?.house ?? 9] ?? 'fortune'} alongside ${PLANET_FACULTY.Mo} fluid balance) are strong when active, while skeletal joints, knees (10th house ${h10.sign}), calves/ankles and venous return (11th house ${h11.sign}${h11.occupants.length ? ` with ${h11.occupants.map((o) => PLANET_SHORT[o.planet] ?? o.planet).join(', ')}` : ''}), hips/thighs (9th house ${h9.sign}), and feet/sleep/lymphatic drainage (12th house ${h12.sign}) respond directly to ${PLANET_FACULTY.Sa} in ${HOUSE_SHORT[sa?.house ?? 7]}: long stationary sitting stiffens the lower back, hips, knees, calves, and feet circulation, making daily walking and lower-body mobility vital for blood flow.`;
    claims.push({
      id: 'body.blood_limbs_feet',
      text: bloodLimbsText,
      detail: `Blood/rakta Ma: ${ma ? cardDetail(ma) : 'n/a'}; Fluids Mo: ${mo ? cardDetail(mo) : 'n/a'}; Joints/nerves Sa: ${sa ? cardDetail(sa) : 'n/a'}; H9 hips/thighs ${h9.sign}; H10 knees/joints ${h10.sign}; H11 legs/calves/ankles ${h11.sign}; H12 feet/sleep/lymph ${h12.sign}`,
      certainty: 'fact',
      evidence: [
        'house:D1.h9',
        'house:D1.h10',
        'house:D1.h11',
        'house:D1.h12',
        ...(ma ? ['planet:D1.Ma'] : []),
        ...(sa ? ['planet:D1.Sa'] : []),
      ],
      range: 'always',
    });
  }

  // 9. Running Primary Reading Clock (`body.now`, e.g. Dwisaptati Sama)
  const run = runningChain(activation, clock.system, asOf);
  if (!opts.sensitive) {
    for (const r of [run.l2, run.l1]) {
      if (!r?.lord) continue;
      const c = view.planet('D1', r.lord);
      const sits = c?.house === 6 || c?.house === 8;
      const acts = r.houses.some((h) => h === 6 || h === 8);
      if (!sits && !acts) continue;
      const what = r.level === 1 ? 'chapter' : 'sub-chapter';
      const where = sits ? `sits where the body ${c!.house === 6 ? 'wears' : 'breaks and renews'}` : 'works on what wears the body';
      const shortLine = `Until ${longDate(r.to)} the ruler of this ${what} ${where}: a steady pace matters.`;
      const fullNow = `${shortLine} Under your primary ${clock.label} clock, the active ${what} activates ${ r.houses.map((h) => HOUSE_SHORT[h]).filter(Boolean).join(', ') || 'service and recovery' }, placing direct demand on daily routine, metabolic balance, digestive pacing, and restorative rest through ${longDate(r.to)}.`;
      claims.push({
        id: 'body.now',
        text: fullNow,
        detail: `${clock.label} level ${r.level} ${pname(r.lord)} ${r.from} → ${r.to}; ${pname(r.lord)} in D1 h${c?.house ?? '?'}; activates houses ${r.houses.join(', ')}`,
        certainty: 'fact',
        evidence: [activationKey(r), `planet:D1.${r.lord}`],
        range: { from: r.from, to: r.to },
      });
      break;
    }

    // 10. All-Dasha Body Convergence across Every Stored System (`body.clocks_vim_narayana`)
    const allRunning = allRunningDashas(activation, asOf, clock.system).filter((s) => s.system !== clock.system && (s.l1 || s.l2));
    const clockEv: string[] = [];
    const clockParts: string[] = [];
    const clockDetails: string[] = [];
    const bodyHouseSet = new Set([1, 2, 3, 4, 6, 8, 12]);
    const bodyActiveSystems: string[] = [];
    for (const s of allRunning) {
      const l1Row = s.l1;
      const l2Row = s.l2;
      if (l1Row) clockEv.push(activationKey(l1Row));
      if (l2Row) clockEv.push(activationKey(l2Row));
      const sysHouses = [...new Set([...(l1Row?.houses ?? []), ...(l2Row?.houses ?? [])])];
      const lbl = clockLabel(s.system);
      if (sysHouses.some((h) => bodyHouseSet.has(h))) {
        bodyActiveSystems.push(lbl);
      }
      if (s.system === 'vimsottari' || s.system === 'narayana' || s.system === 'chara' || s.system === 'yogini' || s.family === 'conditional') {
        const refRow = l2Row ?? l1Row!;
        clockParts.push(
          `${lbl} (${longDate(refRow.from)} to ${longDate(refRow.to)}) activates ${sysHouses.map((h) => HOUSE_SHORT[h]).filter(Boolean).join(', ') || 'vitality and mind'}`,
        );
      }
      clockDetails.push(
        `${lbl} [${s.family}]: ${l1Row ? `L1 ${l1Row.lord ? pname(l1Row.lord) : l1Row.sign} (${l1Row.from}→${l1Row.to}, houses ${l1Row.houses.join(',')})` : ''}${l2Row ? ` / L2 ${l2Row.lord ? pname(l2Row.lord) : l2Row.sign} (${l2Row.from}→${l2Row.to}, houses ${l2Row.houses.join(',')})` : ''}`,
      );
    }
    if (clockDetails.length && clockEv.length) {
      const vimRun = runningChain(activation, 'vimsottari', asOf);
      const narRun = runningChain(activation, 'narayana', asOf);
      const rangeEnd = vimRun.l2?.to ?? narRun.l1?.to ?? run.l2?.to ?? run.l1?.to ?? asOf;
      const rangeStart = vimRun.l2?.from ?? narRun.l1?.from ?? run.l2?.from ?? run.l1?.from ?? asOf;
      const convergenceNote = bodyActiveSystems.length
        ? ` (${bodyActiveSystems.length} parallel dasha systems—${bodyActiveSystems.slice(0, 8).join(', ')}—simultaneously activate the physical/recuperative houses)`
        : '';
      claims.push({
        id: 'body.clocks_vim_narayana',
        text: `Across all ${allRunning.length + 1} stored dasha clocks consulted alongside ${clock.label}${convergenceNote}: ${clockParts.slice(0, 6).join('; ')}, reinforcing the need to balance high mental/partner output with cardiovascular, digestive, and nervous recovery.`,
        detail: clockDetails.join(' | '),
        certainty: 'confirmed',
        evidence: [...new Set(clockEv)],
        range: { from: rangeStart, to: rangeEnd },
      });
    }
  }

  // 11. Multi-Year Tithi Pravesha & Varshaphal Review (`2025`, `2026`, `2027` across `D1..D60` + `tithi_ashtottari` & `mudda`) (`body.tp_review`)
  const annualAll = view.annual();
  if (annualAll.length > 0) {
    const refYear = Number(asOf.slice(0, 4));
    const yearsToInspect = [...new Set([refYear - 1, refYear, refYear + 1, ...annualAll.map((a) => a.year)])].sort((a, b) => a - b);
    const tpEv: string[] = [];
    const tpNotes: string[] = [];
    const tpDetails: string[] = [];
    let activeFrom: string | null = null;
    let activeTo: string | null = null;

    for (const yr of yearsToInspect) {
      const yrRows = annualAll.filter((a) => a.year === yr);
      if (!yrRows.length) continue;
      const tpD1 = yrRows.find((a) => a.kind === 'TP' && a.varga === 'D1');
      const vpD1 = yrRows.find((a) => a.kind === 'VP' && a.varga === 'D1');
      const tpVargas = yrRows.filter((a) => a.kind === 'TP').map((a) => a.varga);
      const vpVargas = yrRows.filter((a) => a.kind === 'VP').map((a) => a.varga);

      for (const r of yrRows) {
        tpEv.push(`annual:${r.kind}${r.year}.${r.varga}`);
      }

      const primaryRow = tpD1 ?? vpD1 ?? yrRows[0]!;
      const h1Ann = primaryRow.houses.find((h) => h.house === 1);
      const h6Ann = primaryRow.houses.find((h) => h.house === 6);
      const h8Ann = primaryRow.houses.find((h) => h.house === 8);
      const l1Placement = h1Ann?.lordHouse ? `lagna ruler in ${HOUSE_SHORT[h1Ann.lordHouse] ?? `H${h1Ann.lordHouse}`}` : primaryRow.lagna ? `rising in ${primaryRow.lagna}` : 'active';

      // Check Tithi Ashtottari on TP (with 108y->1y proportional compression when needed) and Mudda on VP
      const muddaDasha = vpD1?.dashas.find((d) => d.system === 'mudda') ?? vpD1?.dashas[0];
      const muddaWindow =
        muddaDasha && muddaDasha.periods.length
          ? {
              from: muddaDasha.periods.map((p) => p.from).sort()[0]!,
              to: muddaDasha.periods.map((p) => p.to).sort().at(-1)!,
            }
          : null;
      const activeTa = activeTpAshtottariPeriod(tpD1, asOf, muddaWindow);
      const activeMudda = muddaDasha?.periods.find((p) => p.from <= asOf && asOf < p.to) ?? muddaDasha?.periods[0];

      if (activeMudda && yr === refYear) {
        activeFrom = activeMudda.from;
        activeTo = activeMudda.to;
      } else if (activeTa && yr === refYear && !activeFrom) {
        activeFrom = activeTa.from;
        activeTo = activeTa.to;
      }

      // Check divisional TP/VP vargas (D9, D30, D60, etc.) if present
      const vargaNotes: string[] = [];
      for (const vr of yrRows.filter((a) => a.varga !== 'D1')) {
        const vh1 = vr.houses.find((h) => h.house === 1);
        if (vh1?.sign) vargaNotes.push(`${vr.kind}${yr}.${vr.varga} rising ${vh1.sign} (lord ${pname(vh1.lord)} in h${vh1.lordHouse ?? '?'})`);
      }

      const periodNote =
        activeMudda
          ? `active annual period from ${longDate(activeMudda.from)} to ${longDate(activeMudda.to)}`
          : activeTa
            ? `Tithi Ashtottari period from ${longDate(activeTa.from)} to ${longDate(activeTa.to)}`
            : 'annual return window';

      tpNotes.push(
        `${yr} return (${l1Placement}${h6Ann?.occupants.length ? `, 6th house pressure on digestion/routine` : ''}${h8Ann?.occupants.length ? `, 8th house cellular renewal demand` : ''}, ${periodNote})`,
      );
      tpDetails.push(
        `Year ${yr}: TP vargas=[${tpVargas.join(',') || 'none'}], VP vargas=[${vpVargas.join(',') || 'none'}]; lagna=${primaryRow.lagna ?? h1Ann?.sign ?? '?'}; H1 lord ${pname(h1Ann?.lord)} in h${h1Ann?.lordHouse ?? '?'} (${h1Ann?.lordDignity ?? '?'}); H6 occ=[${h6Ann?.occupants.map((o) => pname(o.planet)).join(',') || 'none'}]; H8 occ=[${h8Ann?.occupants.map((o) => pname(o.planet)).join(',') || 'none'}]${activeTa ? `; TP tithi_ashtottari=${pname(activeTa.lord)} ${activeTa.from}→${activeTa.to}` : ''}${activeMudda ? `; VP mudda=${pname(activeMudda.lord)} ${activeMudda.from}→${activeMudda.to}` : ''}${vargaNotes.length ? `; Vargas: ${vargaNotes.join('; ')}` : ''}`,
      );
    }

    if (tpEv.length > 0) {
      claims.push({
        id: 'body.tp_review',
        text: `Tithi Pravesha and solar return review across the current and adjacent return years shows: ${tpNotes.join('; ')}.`,
        detail: tpDetails.join(' || '),
        certainty: 'fact',
        evidence: [...new Set(tpEv)],
        range: activeFrom && activeTo ? { from: activeFrom, to: activeTo } : 'always',
      });
    }
  }

  // 12. Malefics pressing on D1 1st house (`body.pressed`)
  const malefic = (p: string) => {
    const c = view.planet('D1', p);
    return !!c && /malefic/i.test(c.natural ?? '') && /malefic/i.test(c.functional ?? '');
  };
  const on1 = [...h1.occupants.map((o) => o.planet), ...h1.aspectedGraha].filter((p, i, a) => a.indexOf(p) === i && p !== L.planet && malefic(p));
  if (on1.length && PLANET_SHORT[on1[0]!]) {
    claims.push({
      id: 'body.pressed',
      text: `${cap(on1.map((p) => PLANET_SHORT[p]).filter(Boolean).join(' and '))} ${on1.length > 1 ? 'press' : 'presses'} on the body by birth.`,
      detail: `${on1.map(pname).join(', ')} on or aspecting D1 h1; natural and functional malefic`,
      certainty: 'fact',
      evidence: ['house:D1.h1', ...on1.map((p) => `planet:D1.${p}`)],
      range: 'always',
    });
  }

  // 13. D30 Trimsamsa Constitutional Vulnerability (`body.shape`)
  const d30 = view.house('D30', 1);
  if (!d30) g.add('house:D30.h1 missing');
  else {
    const p = d30.occupants.map((o) => o.planet).find((x) => BODY_SHAPE[x]) ?? (d30.lord && BODY_SHAPE[d30.lord] ? d30.lord : null);
    if (p) {
      claims.push({
        id: 'body.shape',
        text: `Under pressure, the body tends toward ${BODY_SHAPE[p]}.`,
        detail: `D30 h1 ${d30.sign}; ${d30.occupants.some((o) => o.planet === p) ? 'occupant' : 'lord'} ${pname(p)}; shape from the BODY_WORDS table`,
        certainty: 'fact',
        evidence: ['house:D30.h1'],
        range: 'always',
      });
    }
  }

  // 14. Special Lagnas, Upagrahas, Prana/Deha/Mrityu Sphutas, Arudhas & Argala on the Body (`body.special_points_argala`)
  const al = pointOf(view, 'D1', 'AL', g);
  const sl = pointOf(view, 'D1', 'SL', g);
  const hl = pointOf(view, 'D1', 'HL', g);
  const gl = pointOf(view, 'D1', 'GL', g);
  const md = pointOf(view, 'D1', 'MD', g);
  const gk = pointOf(view, 'D1', 'GK', g);
  const a6 = pointOf(view, 'D1', 'A6', g);
  const a8 = pointOf(view, 'D1', 'A8', g);
  const prana = view.points('D1').find((p) => p.id === 'sphuta.prana');
  const deha = view.points('D1').find((p) => p.id === 'sphuta.deha');
  const mrityu = view.points('D1').find((p) => p.id === 'sphuta.mrityu');
  const h1Argala = h1.argala;
  const specialEv: string[] = ['house:D1.h1'];
  if (al) specialEv.push('point:D1.AL');
  if (sl) specialEv.push('point:D1.SL');
  if (hl) specialEv.push('point:D1.HL');
  if (gl) specialEv.push('point:D1.GL');
  if (md) specialEv.push('point:D1.MD');
  if (gk) specialEv.push('point:D1.GK');
  if (a6) specialEv.push('point:D1.A6');
  if (a8) specialEv.push('point:D1.A8');
  if (prana) specialEv.push('point:D1.sphuta.prana');
  if (deha) specialEv.push('point:D1.sphuta.deha');

  if (al || sl || hl || md || h1Argala) {
    const argalaSupport = h1Argala ? [...h1Argala.primary, ...h1Argala.secondary].map((p) => PLANET_SHORT[p] ?? p).filter(Boolean).join(' and ') : '';
    const argalaObstruct = h1Argala?.obstructed.map((p) => PLANET_SHORT[p] ?? p).filter(Boolean).join(' and ') ?? '';
    claims.push({
      id: 'body.special_points_argala',
      text: `Across Jaimini Argala, Arudha Padas, Special Lagnas (AL, SL, HL, GL), and Upagrahas (Mandi & Gulika), your physical self receives direct Argala intervention from ${argalaSupport || 'inner focus'}${argalaObstruct ? ` while countered by Virodhargala from ${argalaObstruct}` : ''}; outer standing and vitality (AL & Sree Lagna SL) anchor in ${HOUSE_SHORT[al?.house ?? 10] ?? 'work'}, Hora Lagna (HL) and Prana Sphuta place daily energetic expenditure in ${HOUSE_SHORT[hl?.house ?? 6] ?? 'service'}, Mandi (MD) adds structural load in ${HOUSE_SHORT[md?.house ?? 10] ?? 'work'}, and Roga/Mrityu Padas (A6 in ${HOUSE_SHORT[a6?.house ?? 8] ?? 'change'}, A8 in ${HOUSE_SHORT[a8?.house ?? 4] ?? 'home'}) link physical wear directly to chest/emotional peace and deep recovery.`,
      detail: `H1 Argala primary=[${h1Argala?.primary.join(',') ?? ''}] secondary=[${h1Argala?.secondary.join(',') ?? ''}] obstructed=[${h1Argala?.obstructed.join(',') ?? ''}]; AL=${al?.sign ?? '?'}(H${al?.house ?? '?'}); SL=${sl?.sign ?? '?'}(H${sl?.house ?? '?'}); HL=${hl?.sign ?? '?'}(H${hl?.house ?? '?'}); GL=${gl?.sign ?? '?'}(H${gl?.house ?? '?'}); MD=${md?.sign ?? '?'}(H${md?.house ?? '?'}); GK=${gk?.sign ?? '?'}(H${gk?.house ?? '?'}); A6=${a6?.sign ?? '?'}(H${a6?.house ?? '?'}); A8=${a8?.sign ?? '?'}(H${a8?.house ?? '?'}); Deha=${deha?.sign ?? '?'}(H${deha?.house ?? '?'}); Prana=${prana?.sign ?? '?'}(H${prana?.house ?? '?'}); Mrityu=${mrityu?.sign ?? '?'}(H${mrityu?.house ?? '?'})`,
      certainty: 'fact',
      evidence: specialEv,
      range: 'always',
    });
  }

  // 15. Universal Transit Sky / Gochara & Sarvashtakavarga Gate (`body.sky_gochara`)
  const signToHouse = new Map<string, number>();
  for (const hc of view.houses('D1')) {
    if (hc.sign) signToHouse.set(hc.sign, hc.house);
  }
  const skyNotes: string[] = [];
  const skyDetails: string[] = [];
  if (opts.sky?.ingresses?.length) {
    for (const pl of ['Sa', 'Ju', 'Ra', 'Ke', 'Ma']) {
      const ing = opts.sky.ingresses.find((r) => r.planet === pl && r.from <= asOf && asOf <= r.to);
      if (!ing) continue;
      const hFromLagna = ing.house_from_lagna || signToHouse.get(ing.sign) || null;
      const onMoon = mo?.sign && ing.sign === mo.sign;
      skyNotes.push(
        `${PLANET_SHORT[pl] ?? pl} transiting ${ing.sign}${hFromLagna ? ` (${HOUSE_SHORT[hFromLagna] ?? `H${hFromLagna}`})` : ''}${onMoon ? ' directly over your natal Moon sign' : ''}`,
      );
      skyDetails.push(`Transit ${pname(pl)} in ${ing.sign} (${ing.from}→${ing.to}, H${hFromLagna ?? '?'} from Lagna${onMoon ? ', Janma Moon sign' : ''})`);
    }
  }
  const savSummary = [1, 2, 4, 6, 8, 12]
    .map((h) => {
      const hc = view.house('D1', h);
      return hc?.sav != null ? `H${h}=${hc.sav}` : null;
    })
    .filter(Boolean)
    .join(', ');
  const k64m = view.points('D1').find((pt) => pt.id === 'K64M');
  const kd22 = view.points('D1').find((pt) => pt.id === 'KD22');
  if (skyNotes.length > 0 || savSummary) {
    claims.push({
      id: 'body.sky_gochara',
      text: skyNotes.length
        ? `In the current universal transit sky, ${skyNotes.join('; ')}, gated by your natal house resilience (${savSummary || 'balanced bindus'}) across head, chest, digestion, and limbs.`
        : `Your natal Ashtakavarga resilience across the body houses (${savSummary}) and sensitive transit points (${k64m?.sign ? `64th Navamsa in ${k64m.sign}` : 'active'}) govern how external transit weather registers in your stamina and recovery.`,
      detail: `${skyDetails.join('; ') || 'Evaluated via natal SAV and sensitive points'}; SAV bindus: ${savSummary || 'n/a'}${k64m?.sign ? `; K64M=${k64m.sign} (H${k64m.house ?? '?'})` : ''}${kd22?.sign ? `; KD22=${kd22.sign} (H${kd22.house ?? '?'})` : ''}`,
      certainty: 'fact',
      evidence: [
        'house:D1.h1',
        'house:D1.h6',
        ...(mo ? ['planet:D1.Mo'] : []),
        ...(k64m ? ['point:D1.K64M'] : []),
        ...(kd22 ? ['point:D1.KD22'] : []),
      ],
      range: 'always',
    });
  }

  if (!opts.skyStored && !opts.sky) {
    g.add('sky overlay not stored: Saturn, Mars and the nodes over the lagna and the Moon not checked');
  }
  const lead = claims[0]?.text ?? '';
  return { ...body(lead, claims, g), note: BODY_NOTE };
}

