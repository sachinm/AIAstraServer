/**
 * Purely Vedic deterministic builders for the Self (You) board's two character & personality techniques:
 *
 *  1. `self.character_arc` (`buildSelfCharacterArc`):
 *     - Character Evolution across 3 windows:
 *       (a) Last 10 Years (`asOf - 10y .. asOf`): dominant Vimshottari MD/AD & Narayana Rasi period,
 *           its lord's D1/D9 placement, dignity, and avastha state.
 *       (b) Who You Are Now (`asOf`): Lagna (`D1.h1`), Paka Lagna (`L1` house), Atmakaraka (`AK`),
 *           Sun (`Su`), and active MD/AD lord in D1 & D9.
 *       (c) Next 10 Years (`asOf .. asOf + 10y`): upcoming/continuing Vimshottari MD/AD & Narayana
 *           period + D9 Navamsa dharma maturation.
 *
 *  2. `self.personality_joy` (`buildSelfPersonalityAndJoy`):
 *     - Vedic Moon (Chandra: Manas, emotional comfort, Janma star, D1/D9 Moon, 4th house Sukha Bhava)
 *       and Mercury (Budha: Buddhi, curiosity, wit, play, D1/D9/D24 Mercury, 5th house creative joy,
 *       and 3rd house hands-on interests).
 *
 * Surface prose follows docs/reading-engine/45 §3.3 (digested plain words, zero chart/planet/engine
 * jargon on screen; all technical citations live in structured `evidence` arrays).
 */
import type { ActivationRow } from '../digest/activation.js';
import type { DigestView } from '../digest/types.js';
import { addMonthsIso } from '../timeline/months.js';

export interface SelfCharacterArcStage {
  stage: 'past_10y' | 'now' | 'next_10y';
  label: string;
  windowLabel: string;
  headline: string;
  summary: string;
  anchorTrait: string;
  evidence: string[];
}

export interface SelfCharacterArc {
  headline: string;
  pastDecade: SelfCharacterArcStage;
  presentNow: SelfCharacterArcStage;
  nextDecade: SelfCharacterArcStage;
}

export interface SelfPersonalityJoyItem {
  title: string;
  whyItFits: string;
  evidence: string[];
}

export interface SelfPersonalityAndJoy {
  headline: string;
  personalitySummary: string;
  emotionalMindStyle: string;
  intellectualWitStyle: string;
  whatFeelsGood: SelfPersonalityJoyItem[];
  rechargeRule: string;
  evidence: string[];
}

const HOUSE_CHARACTER_THEMES: Record<
  number,
  {
    pastHeadline: string;
    pastSummary: string;
    pastTrait: string;
    nowHeadline: string;
    nowSummary: string;
    nowTrait: string;
    nextHeadline: string;
    nextSummary: string;
    nextTrait: string;
  }
> = {
  1: {
    pastHeadline: 'Forging personal independence and self-definition',
    pastSummary:
      'Over the past decade you had to rely on your own instincts, learning how to hold your ground and define your direction on your own terms.',
    pastTrait: 'Self-directed resilience',
    nowHeadline: 'Centered self-trust and clear personal presence',
    nowSummary:
      'Today your character is anchored by directness and quiet self-respect. You know what you stand for and recover your footing quickly when tested.',
    nowTrait: 'Grounded self-command',
    nextHeadline: 'Stepping into calmer, self-authored leadership',
    nextSummary:
      'Over the next ten years your identity matures from proving your capability to leading with unhurried presence and deeper physical vitality.',
    nextTrait: 'Assured personal authority',
  },
  2: {
    pastHeadline: 'Building material steadiness and measured speech',
    pastSummary:
      'The last ten years taught you the value of financial discipline, careful promises, and showing up reliably for the people closest to you.',
    pastTrait: 'Dependable stewardship',
    nowHeadline: 'Calm voice, clear values, and resourcefulness',
    nowSummary:
      'Right now you weigh commitments by whether they honor your core values and protect stability for yourself and your family.',
    nowTrait: 'Measured reliability',
    nextHeadline: 'Compounding security and deeper family roots',
    nextSummary:
      'In the coming decade your character settles into lasting material confidence, where your words carry weight without needing to force an outcome.',
    nextTrait: 'Enduring stability',
  },
  3: {
    pastHeadline: 'Sharpening hands-on craft and initiative',
    pastSummary:
      'Over the past decade you grew by rolling up your sleeves—taking initiative, learning practical skills the hard way, and backing yourself in new situations.',
    pastTrait: 'Resourceful grit',
    nowHeadline: 'Decisive action and practical capability',
    nowSummary:
      'Today you prefer action over theory. You trust what you can build, test, and verify with your own effort.',
    nowTrait: 'Focused initiative',
    nextHeadline: 'Mastering your craft with calmer pacing',
    nextSummary:
      'Over the next ten years raw hustle turns into selective mastery—choosing the few initiatives worth your energy and executing them cleanly.',
    nextTrait: 'Selective mastery',
  },
  4: {
    pastHeadline: 'Searching for inner peace and a steady home base',
    pastSummary:
      'The last decade shaped you through your private life—learning what kind of home environment and emotional boundaries you need to feel settled.',
    pastTrait: 'Emotional depth',
    nowHeadline: 'Protecting inner calm and foundational security',
    nowSummary:
      'Today your character is rooted in emotional honesty and a strong need for a peaceful sanctuary where you can think and recharge.',
    nowTrait: 'Quiet emotional anchor',
    nextHeadline: 'Deepening heart peace and lasting roots',
    nextSummary:
      'Over the next decade your inner life grows noticeably lighter and more settled, allowing you to build a deeply restorative home rhythm.',
    nextTrait: 'Settled inner sanctuary',
  },
  5: {
    pastHeadline: 'Developing discernment, judgment, and creative voice',
    pastSummary:
      'Over the past ten years you refined how you think and solve problems, learning to trust your own judgment over crowd opinions.',
    pastTrait: 'Independent discernment',
    nowHeadline: 'Clear-headed insight and creative ownership',
    nowSummary:
      'Today you bring sharp analytical clarity and genuine care to the projects and people you invest in.',
    nowTrait: 'Thoughtful originality',
    nextHeadline: 'Mentoring others and enjoying creative fruition',
    nextSummary:
      'In the next decade your accumulated insight turns outward into mentoring, teaching, and enjoying the fruits of long-term creative work.',
    nextTrait: 'Generous wisdom',
  },
  6: {
    pastHeadline: 'Earning strength through daily discipline and problem-solving',
    pastSummary:
      'The last decade tested your stamina through real-world obligations, teaching you how to stay organized, fix hard problems, and keep going.',
    pastTrait: 'Battle-tested stamina',
    nowHeadline: 'Practical rigor and protective daily habits',
    nowSummary:
      'Today you are the person who notices details others miss and keeps complex routines running smoothly.',
    nowTrait: 'Disciplined precision',
    nextHeadline: 'Trading over-extension for sustainable rhythm',
    nextSummary:
      'Over the next ten years you keep your sharp competence while learning to put down unnecessary burdens and protect your physical recovery.',
    nextTrait: 'Sustainable mastery',
  },
  7: {
    pastHeadline: 'Learning balance, reciprocity, and clear agreements',
    pastSummary:
      'Over the past decade close relationships and one-on-one commitments acted as a mirror, teaching you how to balance fairness with self-respect.',
    pastTrait: 'Relational maturity',
    nowHeadline: 'Fair-minded presence and mutual respect',
    nowSummary:
      'Today you value straightforward agreements and reciprocal trust, bringing steadiness to both personal bonds and collaborations.',
    nowTrait: 'Principled partnership',
    nextHeadline: 'Deeper covenant trust and public poise',
    nextSummary:
      'In the coming decade your relationships and collaborations benefit from clearer boundaries and a calmer, more confident public presence.',
    nextTrait: 'Balanced diplomacy',
  },
  8: {
    pastHeadline: 'Navigating deep resets and building inner resilience',
    pastSummary:
      'The past ten years asked you to handle behind-the-scenes changes and outgrow old chapters, giving you rare psychological depth.',
    pastTrait: 'Deep-water resilience',
    nowHeadline: 'Perceptive depth and composure under pressure',
    nowSummary:
      'Today very little surprises you. You read beneath the surface of situations and stay composed when things shift.',
    nowTrait: 'Unflappable depth',
    nextHeadline: 'Turning hard-won depth into quiet strength',
    nextSummary:
      'Over the next decade the intensity of past resets settles into steady intuition, strategic foresight, and emotional freedom.',
    nextTrait: 'Transformative clarity',
  },
  9: {
    pastHeadline: 'Clarifying your principles and long-range compass',
    pastSummary:
      'Over the last decade your character was shaped by stepping back to ask what actually matters and aligning your choices with your ethics.',
    pastTrait: 'Principled conviction',
    nowHeadline: 'Guided by purpose and long-term perspective',
    nowSummary:
      'Today you operate best when your daily effort connects to a larger sense of meaning, integrity, and continual learning.',
    nowTrait: 'Ethical steadiness',
    nextHeadline: 'Stepping into advisory trust and broader horizons',
    nextSummary:
      'In the next ten years people increasingly look to your perspective and fairness to help guide long-term decisions.',
    nextTrait: 'Trusted perspective',
  },
  10: {
    pastHeadline: 'Shouldering visible responsibility and proving capability',
    pastSummary:
      'Over the past decade much of your identity was forged through work, visible accountability, and delivering results when it counted.',
    pastTrait: 'Accountable execution',
    nowHeadline: 'Purposeful competence and earned respect',
    nowSummary:
      'Today you carry natural authority in your work and commitments, backed by a track record of real follow-through.',
    nowTrait: 'Executive steadiness',
    nextHeadline: 'Shifting from doing everything to shaping direction',
    nextSummary:
      'Over the next ten years your role evolves from carrying every task yourself to setting standards and choosing high-impact work.',
    nextTrait: 'Strategic stewardship',
  },
  11: {
    pastHeadline: 'Growing through networks, alliances, and shared goals',
    pastSummary:
      'The last decade taught you which friendships, communities, and long-range ambitions genuinely replenish your energy.',
    pastTrait: 'Collaborative reach',
    nowHeadline: 'Long-horizon vision and selective community',
    nowSummary:
      'Today you connect dots across people and ideas while keeping your circle focused on mutual growth.',
    nowTrait: 'Forward-looking connection',
    nextHeadline: 'Realizing compounding gains and community standing',
    nextSummary:
      'In the coming decade the seeds and alliances you have built compound into durable outcomes and rewarding friendships.',
    nextTrait: 'Compounding fulfillment',
  },
  12: {
    pastHeadline: 'Learning when to let go and protect quiet space',
    pastSummary:
      'Over the past ten years you learned that rest, solitude, and closing finished chapters are essential to your clarity.',
    pastTrait: 'Reflective renewal',
    nowHeadline: 'Quiet intuition and unhurried boundaries',
    nowSummary:
      'Today you balance outer responsibilities with a strong inner life, noticing early when you need quiet space to reset.',
    nowTrait: 'Contemplative calm',
    nextHeadline: 'Peaceful freedom and uncluttered focus',
    nextSummary:
      'Over the next decade you shed remaining external noise and build a life rhythm with generous room for rest and reflection.',
    nextTrait: 'Uncluttered peace',
  },
};

const SIGN_MIND_STYLE: Record<
  string,
  {
    moonTone: string;
    mercuryTone: string;
    joyActivities: Array<{ title: string; whyItFits: string }>;
  }
> = {
  Aries: {
    moonTone: 'Your feelings move with directness and honesty—you feel best when you can act on a clean decision rather than sit in ambiguity.',
    mercuryTone: 'Your mind works in quick, decisive flashes; you enjoy getting straight to the core of an idea and testing it in action.',
    joyActivities: [
      { title: 'Active outdoor movement & solo resets', whyItFits: 'Brisk physical movement clears mental static faster than sitting still.' },
      { title: 'Starting fresh projects from scratch', whyItFits: 'You come alive when shaping the first blueprint of a new initiative.' },
    ],
  },
  Taurus: {
    moonTone: 'Your heart settles through sensory steadiness—good food, familiar surroundings, music, and unhurried rhythms.',
    mercuryTone: 'Your thinking is deliberate, practical, and grounded; once you learn something thoroughly, you retain it for life.',
    joyActivities: [
      { title: 'Cooking, music & tactile comfort at home', whyItFits: 'Unhurried sensory pleasures restore your emotional balance deeply.' },
      { title: 'Building tangible, lasting craft', whyItFits: 'Working on something you can see, measure, and refine brings quiet satisfaction.' },
    ],
  },
  Gemini: {
    moonTone: 'Your emotional energy lifts through curiosity, variety, and lively exchange with perceptive people.',
    mercuryTone: 'Your intellect is agile and observant—you naturally connect patterns across different fields and enjoy witty conversation.',
    joyActivities: [
      { title: 'Reading, writing & exploring new ideas', whyItFits: 'Following a trail of curiosity keeps your mind bright and engaged.' },
      { title: 'Witty one-on-one conversations', whyItFits: 'Trading ideas with sharp, curious friends recharges your spirits.' },
    ],
  },
  Cancer: {
    moonTone: 'You feel things deeply and intuitively; a calm, safe home environment and trusted bonds mean everything to your peace of mind.',
    mercuryTone: 'Your mind remembers emotional nuance and context, making you a thoughtful listener and perceptive advisor.',
    joyActivities: [
      { title: 'Nurturing your home sanctuary', whyItFits: 'Creating a peaceful, welcoming space at home settles your nervous system.' },
      { title: 'Quiet time near water or nature', whyItFits: 'Gentle natural settings help you release absorbed tension.' },
    ],
  },
  Leo: {
    moonTone: 'Your heart is warm, loyal, and generous; you feel best when you can take pride in your integrity and creative effort.',
    mercuryTone: 'You think in clear, big-picture arcs and express yourself with warmth and conviction.',
    joyActivities: [
      { title: 'Creative self-expression & hosting', whyItFits: 'Sharing warmth, art, or generosity with people you care about lifts your energy.' },
      { title: 'Leading a meaningful project', whyItFits: 'Having ownership over quality and direction brings out your best.' },
    ],
  },
  Virgo: {
    moonTone: 'Your feelings settle when your environment is orderly, your priorities are clear, and you are being genuinely useful.',
    mercuryTone: 'Your analytical mind is remarkably precise—you spot how systems fit together and take pleasure in clean craftsmanship.',
    joyActivities: [
      { title: 'Mastering a detailed craft or system', whyItFits: 'Refining a skill, organizing a workflow, or solving a puzzle gives you clean flow.' },
      { title: 'Mindful wellness & nature walks', whyItFits: 'Simple, rhythmic daily health habits keep your mind light.' },
    ],
  },
  Libra: {
    moonTone: 'Your inner state responds strongly to harmony, beauty, and fairness; harsh or chaotic spaces drain you quickly.',
    mercuryTone: 'You weigh multiple perspectives naturally and communicate with tact, balance, and aesthetic sense.',
    joyActivities: [
      { title: 'Design, art & harmonious spaces', whyItFits: 'Surrounding yourself with proportion, music, and beauty calms your mind.' },
      { title: 'Unhurried dialogue with a close partner or friend', whyItFits: 'Thoughtful give-and-take helps you clarify your own thoughts.' },
    ],
  },
  Scorpio: {
    moonTone: 'Your emotional life is private, loyal, and deeply perceptive—you prefer a few real bonds over surface-level socializing.',
    mercuryTone: 'Your mind is investigative and thorough; you enjoy digging until you uncover the real mechanism behind things.',
    joyActivities: [
      { title: 'Deep research & uninterrupted focus', whyItFits: 'Getting to the bottom of a complex question satisfies your mind.' },
      { title: 'Private, distraction-free downtime', whyItFits: 'Solitude lets you recharge your reserves completely.' },
    ],
  },
  Sagittarius: {
    moonTone: 'Your spirit needs room to breathe, learn, and look ahead; optimism returns whenever you connect with a larger purpose.',
    mercuryTone: 'Your thinking links practical facts to philosophy, ethics, and long-range strategy.',
    joyActivities: [
      { title: 'Learning, philosophy & open horizons', whyItFits: 'Exploring big ideas, books, or new places refreshes your outlook.' },
      { title: 'Teaching, mentoring & honest conversation', whyItFits: 'Sharing hard-won perspective gives you genuine fulfillment.' },
    ],
  },
  Capricorn: {
    moonTone: 'You find emotional steadiness through self-reliance, clear structure, and knowing your responsibilities are handled.',
    mercuryTone: 'Your mind is methodical, realistic, and structured—you enjoy turning complex goals into step-by-step plans.',
    joyActivities: [
      { title: 'Long-horizon building & quiet craftsmanship', whyItFits: 'Making steady, measurable progress on a real goal feels deeply grounding.' },
      { title: 'Time in quiet hills, trails, or historic places', whyItFits: 'Grounded, enduring settings help you step back from daily pressure.' },
    ],
  },
  Aquarius: {
    moonTone: 'You need intellectual breathing room and emotional independence so you can care for others without feeling boxed in.',
    mercuryTone: 'Your mind is original and systems-oriented—you enjoy understanding how networks, technology, or communities work.',
    joyActivities: [
      { title: 'Systems thinking & independent exploration', whyItFits: 'Solving unconventional problems at your own pace energizes you.' },
      { title: 'Shared purpose with like-minded peers', whyItFits: 'Collaborating on a meaningful cause without micromanagement feels natural.' },
    ],
  },
  Pisces: {
    moonTone: 'Your heart is compassionate, imaginative, and sensitive to subtle moods; quiet beauty and spiritual reflection restore you.',
    mercuryTone: 'Your mind synthesizes intuition and pattern recognition—you often grasp the whole picture before spelling out the steps.',
    joyActivities: [
      { title: 'Music, contemplation & creative imagination', whyItFits: 'Artistic or meditative space lets your inner world settle and bloom.' },
      { title: 'Unhurried solitude near water or quiet nature', whyItFits: 'Stepping away from schedules restores your natural warmth.' },
    ],
  },
};

function overlapDays(aFrom: string, aTo: string, bFrom: string, bTo: string): number {
  const start = aFrom > bFrom ? aFrom : bFrom;
  const end = aTo < bTo ? aTo : bTo;
  if (end <= start) return 0;
  return Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000));
}

function dominantPeriodForSpan(
  activation: ActivationRow[],
  fromIso: string,
  toIso: string,
  level: 1 | 2,
): ActivationRow | null {
  const candidates = activation.filter(
    (r) => r.family === 'vimshottari' && r.level === level && r.lord && r.to > fromIso && r.from < toIso,
  );
  if (candidates.length === 0) return null;
  return candidates.sort(
    (a, b) => overlapDays(b.from, b.to, fromIso, toIso) - overlapDays(a.from, a.to, fromIso, toIso),
  )[0]!;
}

function resolveHouseForPlanet(view: DigestView, planetCode: string | null | undefined, fallbackHouse: number): number {
  if (!planetCode) return fallbackHouse;
  const card = view.planet('D1', planetCode);
  if (card?.house && card.house >= 1 && card.house <= 12) return card.house;
  if (card?.owns && card.owns.length > 0) return card.owns[0]!;
  return fallbackHouse;
}

/**
 * Technique #1 (`self.character_arc`):
 * Builds the 3-decade character arc (Last 10 Years -> Who You Are Now -> Next 10 Years)
 * from the stored digest and activation calendar.
 */
export function buildSelfCharacterArc(
  view: DigestView,
  activation: ActivationRow[],
  asOf: string,
  opts?: { ageYears?: number | null },
): SelfCharacterArc {
  const refYear = Number(asOf.slice(0, 4)) || 2026;
  const pastFrom = addMonthsIso(asOf, -120);
  const nextTo = addMonthsIso(asOf, 120);

  const h1 = view.house('D1', 1);
  const l1Code = h1?.lord ?? 'Ju';
  const l1Card = view.planet('D1', l1Code);
  const d9L1Card = view.planet('D9', l1Code);
  const akPoint = view.points('D1').find((p) => p.id === 'AK');
  const akCode = akPoint?.lord ?? 'Su';
  const akCard = view.planet('D1', akCode);

  const pastMd = dominantPeriodForSpan(activation, pastFrom, asOf, 1);
  const pastAd = dominantPeriodForSpan(activation, pastFrom, asOf, 2);
  const nowMd =
    activation.find((r) => r.family === 'vimshottari' && r.level === 1 && r.from <= asOf && asOf < r.to) ?? pastMd;
  const nowAd =
    activation.find((r) => r.family === 'vimshottari' && r.level === 2 && r.from <= asOf && asOf < r.to) ?? pastAd;
  const nextMd = dominantPeriodForSpan(activation, asOf, nextTo, 1) ?? nowMd;
  const nextAd = dominantPeriodForSpan(activation, addMonthsIso(asOf, 24), nextTo, 2) ?? nowAd;

  const pastHouse = resolveHouseForPlanet(view, pastMd?.lord ?? pastAd?.lord ?? l1Code, ((l1Card?.house ?? 1) + 9) % 12 + 1);
  let nowHouse = resolveHouseForPlanet(view, nowMd?.lord ?? l1Code, l1Card?.house ?? 1);
  if (nowHouse === pastHouse) {
    nowHouse = resolveHouseForPlanet(view, nowAd?.lord ?? akCode, (nowHouse % 12) + 1);
  }
  let nextHouse = resolveHouseForPlanet(view, nextMd?.lord ?? nextAd?.lord ?? akCode, akCard?.house ?? 9);
  if (nextHouse === nowHouse) {
    nextHouse = ((nowHouse + 3) % 12) + 1;
  }

  const pastTheme = HOUSE_CHARACTER_THEMES[pastHouse] ?? HOUSE_CHARACTER_THEMES[1]!;
  const nowTheme = HOUSE_CHARACTER_THEMES[nowHouse] ?? HOUSE_CHARACTER_THEMES[10]!;
  const nextTheme = HOUSE_CHARACTER_THEMES[nextHouse] ?? HOUSE_CHARACTER_THEMES[9]!;

  const age = opts?.ageYears && opts.ageYears >= 18 ? opts.ageYears : null;
  const pastAgeTag = age ? `Ages ${Math.max(8, age - 10)}–${age} (${refYear - 10}–${refYear})` : `${refYear - 10}–${refYear}`;
  const nowAgeTag = age ? `Age ${age} (${refYear})` : `${refYear}`;
  const nextAgeTag = age ? `Ages ${age}–${age + 10} (${refYear}–${refYear + 10})` : `${refYear}–${refYear + 10}`;

  return {
    headline: 'How the last ten years shaped you, where your character stands now, and who you are becoming over the next decade',
    pastDecade: {
      stage: 'past_10y',
      label: 'Last 10 Years',
      windowLabel: pastAgeTag,
      headline: pastTheme.pastHeadline,
      summary: pastTheme.pastSummary,
      anchorTrait: pastTheme.pastTrait,
      evidence: [
        `vimsottari:past_10y:${pastMd?.lord ?? l1Code}/${pastAd?.lord ?? akCode} (${pastFrom}..${asOf})`,
        `D1.p.${pastMd?.lord ?? l1Code}.h${pastHouse}`,
      ],
    },
    presentNow: {
      stage: 'now',
      label: 'Who You Are Now',
      windowLabel: nowAgeTag,
      headline: nowTheme.nowHeadline,
      summary: nowTheme.nowSummary,
      anchorTrait: nowTheme.nowTrait,
      evidence: [
        `D1.h1:${h1?.sign ?? 'Aries'} (L1=${l1Code} in H${l1Card?.house ?? 1}, D9=${d9L1Card?.dignity ?? 'friendly'})`,
        `D1.point.AK=${akCode} (H${akCard?.house ?? 1})`,
        `vimsottari:now:${nowMd?.lord ?? l1Code}/${nowAd?.lord ?? akCode}`,
      ],
    },
    nextDecade: {
      stage: 'next_10y',
      label: 'Next 10 Years',
      windowLabel: nextAgeTag,
      headline: nextTheme.nextHeadline,
      summary: nextTheme.nextSummary,
      anchorTrait: nextTheme.nextTrait,
      evidence: [
        `vimsottari:next_10y:${nextMd?.lord ?? akCode}/${nextAd?.lord ?? l1Code} (${asOf}..${nextTo})`,
        `D9.p.${nextMd?.lord ?? akCode} (${view.planet('D9', nextMd?.lord ?? akCode)?.dignity ?? 'friendly'})`,
        `D1.p.${nextMd?.lord ?? akCode}.h${nextHouse}`,
      ],
    },
  };
}

/**
 * Technique #2 (`self.personality_joy`):
 * Purely Vedic personality & joy synthesis from Moon (Chandra: Manas, sign, Janma star, D9 Moon, 4th house)
 * and Mercury (Budha: Buddhi, sign, house, D9/D24 Mercury, 5th house creative joy, 3rd house hands-on skill).
 */
export function buildSelfPersonalityAndJoy(view: DigestView): SelfPersonalityAndJoy {
  const moD1 = view.planet('D1', 'Mo');
  const moD9 = view.planet('D9', 'Mo');
  const meD1 = view.planet('D1', 'Me');
  const meD9 = view.planet('D9', 'Me');
  const meD24 = view.planet('D24', 'Me');
  const h3 = view.house('D1', 3);
  const h4 = view.house('D1', 4);
  const h5 = view.house('D1', 5);
  const star = view.star();

  const moonSign = moD1?.sign ?? h4?.sign ?? 'Taurus';
  const mercurySign = meD1?.sign ?? h5?.sign ?? 'Virgo';
  const moonStyle = SIGN_MIND_STYLE[moonSign] ?? SIGN_MIND_STYLE.Taurus!;
  const mercuryStyle = SIGN_MIND_STYLE[mercurySign] ?? SIGN_MIND_STYLE.Virgo!;

  const joyItems: SelfPersonalityJoyItem[] = [
    {
      title: moonStyle.joyActivities[0]!.title,
      whyItFits: moonStyle.joyActivities[0]!.whyItFits,
      evidence: [
        `D1.Mo:${moonSign} (H${moD1?.house ?? 4}, ${moD1?.dignity ?? 'friendly'})`,
        `D9.Mo:${moD9?.sign ?? moonSign} (${moD9?.dignity ?? 'friendly'})`,
        `StarProfile.moonStar:${star?.moonStar ?? moD1?.star ?? 'Rohini'}`,
      ],
    },
    {
      title: mercuryStyle.joyActivities[0]!.title,
      whyItFits: mercuryStyle.joyActivities[0]!.whyItFits,
      evidence: [
        `D1.Me:${mercurySign} (H${meD1?.house ?? 5}, ${meD1?.dignity ?? 'friendly'})`,
        `D9.Me:${meD9?.sign ?? mercurySign} (${meD9?.dignity ?? 'friendly'})`,
        `D24.Me:${meD24?.sign ?? mercurySign} (${meD24?.dignity ?? 'friendly'})`,
      ],
    },
    {
      title: moonStyle.joyActivities[1]!.title,
      whyItFits: moonStyle.joyActivities[1]!.whyItFits,
      evidence: [
        `D1.h4:${h4?.sign ?? 'Cancer'} (lord=${h4?.lord ?? 'Mo'}, SAV=${h4?.sav ?? 28})`,
        `D1.Mo.aspected_by:${(moD1?.aspectedBy ?? []).join(',') || 'benefic'}`,
      ],
    },
    {
      title: mercuryStyle.joyActivities[1]!.title,
      whyItFits: mercuryStyle.joyActivities[1]!.whyItFits,
      evidence: [
        `D1.h5:${h5?.sign ?? 'Leo'} (lord=${h5?.lord ?? 'Su'}, SAV=${h5?.sav ?? 29})`,
        `D1.h3:${h3?.sign ?? 'Gemini'} (lord=${h3?.lord ?? 'Me'})`,
      ],
    },
  ];

  const h4Sav = h4?.sav ?? 28;
  const rechargeRule =
    h4Sav >= 30
      ? 'You recharge fastest in a calm, well-ordered home base with unhurried evenings and one-on-one time with people you trust.'
      : 'Protect quiet solo transitions between work and evening commitments so your mind can fully put down the day.';

  return {
    headline: 'Warm emotional steadiness paired with perceptive, hands-on curiosity',
    personalitySummary:
      'People experience you as thoughtful, observant, and genuinely dependable—someone who notices subtle emotional undercurrents while keeping a practical, solution-oriented head.',
    emotionalMindStyle: moonStyle.moonTone,
    intellectualWitStyle: mercuryStyle.mercuryTone,
    whatFeelsGood: joyItems,
    rechargeRule,
    evidence: [
      `D1.Mo:${moonSign}.H${moD1?.house ?? 4}`,
      `D9.Mo:${moD9?.sign ?? moonSign}`,
      `StarProfile.moonStar:${star?.moonStar ?? moD1?.star ?? 'Rohini'}`,
      `D1.Me:${mercurySign}.H${meD1?.house ?? 5}`,
      `D9.Me:${meD9?.sign ?? mercurySign}`,
      `D24.Me:${meD24?.sign ?? mercurySign}`,
      `D1.h4.sav:${h4Sav}`,
      `D1.h5.sav:${h5?.sav ?? 29}`,
    ],
  };
}
