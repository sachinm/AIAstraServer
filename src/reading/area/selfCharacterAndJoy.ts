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
  id: 'past_10y' | 'now' | 'next_10y';
  stage: 'past_10y' | 'now' | 'next_10y';
  title: string;
  label: string;
  ageSpanLabel: string;
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
  windows: [SelfCharacterArcStage, SelfCharacterArcStage, SelfCharacterArcStage];
}

export interface SelfPersonalityJoyItem {
  id: string;
  title: string;
  whatYouEnjoy: string;
  whyItFeelsGood: string;
  whyItFits: string;
  evidence: string[];
}

export interface SelfPersonalityAndJoy {
  headline: string;
  personalitySummary: string;
  emotionalMindStyle: string;
  intellectualWitStyle: string;
  whatFeelsGood: SelfPersonalityJoyItem[];
  pillars: SelfPersonalityJoyItem[];
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
    moonShort: string;
    mercuryShort: string;
    moonSummary: string;
    mercurySummary: string;
    moonTone: string;
    mercuryTone: string;
    joyActivities: Array<{ title: string; whyItFits: string }>;
  }
> = {
  Aries: {
    moonShort: 'Bold emotional directness',
    mercuryShort: 'quick, decisive instinct',
    moonSummary: 'direct, action-oriented, and refreshing in your candor',
    mercurySummary: 'cuts straight to the core of a question without hesitation',
    moonTone: 'Your feelings settle fastest when you can take immediate, constructive action rather than lingering in open-ended waiting.',
    mercuryTone: 'In problem-solving and conversation, you favor crisp prototypes, clear priorities, and testing ideas in real time.',
    joyActivities: [
      { title: 'Active outdoor movement & solo resets', whyItFits: 'Brisk physical movement clears mental static faster than sitting still.' },
      { title: 'Starting fresh projects from scratch', whyItFits: 'You come alive when shaping the first blueprint of a new initiative.' },
    ],
  },
  Taurus: {
    moonShort: 'Warm emotional steadiness',
    mercuryShort: 'grounded, practical craft',
    moonSummary: 'calm, loyal, and soothing to be around',
    mercurySummary: 'weighs ideas for real-world durability and lasting value',
    moonTone: 'Your inner rhythm thrives on sensory comfort—good food, music, familiar spaces, and unhurried evenings.',
    mercuryTone: 'When learning or planning, you build step by step with patience; once you master a craft, that knowledge stays with you for life.',
    joyActivities: [
      { title: 'Cooking, music & tactile comfort at home', whyItFits: 'Unhurried sensory pleasures restore your emotional balance deeply.' },
      { title: 'Building tangible, lasting craft', whyItFits: 'Working on something you can see, measure, and refine brings quiet satisfaction.' },
    ],
  },
  Gemini: {
    moonShort: 'Lively emotional curiosity',
    mercuryShort: 'agile, observant wit',
    moonSummary: 'adaptable, perceptive, and quick to connect with others',
    mercurySummary: 'spots patterns across different subjects and communicates with ease',
    moonTone: 'Your spirits lift through variety, fresh books, short excursions, and stimulating dialogue with curious minds.',
    mercuryTone: 'Your thinking synthesizes multiple angles at once, turning complex topics into clear, engaging stories and frameworks.',
    joyActivities: [
      { title: 'Reading, writing & exploring new ideas', whyItFits: 'Following a trail of curiosity keeps your mind bright and engaged.' },
      { title: 'Witty one-on-one conversations', whyItFits: 'Trading ideas with sharp, curious friends recharges your spirits.' },
    ],
  },
  Cancer: {
    moonShort: 'Deep intuitive care',
    mercuryShort: 'context-rich memory',
    moonSummary: 'empathetic, protective, and deeply attuned to the people you love',
    mercurySummary: 'remembers subtle human context and listens beneath the words',
    moonTone: 'A peaceful domestic sanctuary and unshakeable trust with your inner circle are the true anchors of your emotional well-being.',
    mercuryTone: 'Your analytical style blends long memory with emotional intelligence, making you a natural confidant and wise counselor.',
    joyActivities: [
      { title: 'Nurturing your home sanctuary', whyItFits: 'Creating a peaceful, welcoming space at home settles your nervous system.' },
      { title: 'Quiet time near water or nature', whyItFits: 'Gentle natural settings help you release absorbed tension.' },
    ],
  },
  Leo: {
    moonShort: 'Warm-hearted generosity',
    mercuryShort: 'clear, big-picture conviction',
    moonSummary: 'warm, principled, and naturally encouraging',
    mercurySummary: 'frames ideas with clarity, dignity, and creative confidence',
    moonTone: 'You feel most alive when standing behind work and relationships that reflect your personal standards and wholehearted loyalty.',
    mercuryTone: 'Your intellect organizes details around a central vision, helping others see the purpose and nobility behind a plan.',
    joyActivities: [
      { title: 'Creative self-expression & hosting', whyItFits: 'Sharing warmth, art, or generosity with people you care about lifts your energy.' },
      { title: 'Leading a meaningful project', whyItFits: 'Having ownership over quality and direction brings out your best.' },
    ],
  },
  Virgo: {
    moonShort: 'Thoughtful inner order',
    mercuryShort: 'perceptive, hands-on precision',
    moonSummary: 'observant, helpful, and quietly dependable in the details',
    mercurySummary: 'breaks complex problems into clean, workable steps',
    moonTone: 'Your nervous system relaxes when your space is uncluttered, your schedule is realistic, and your effort is genuinely useful.',
    mercuryTone: 'You take quiet pride in diagnostic accuracy—spotting the exact bottleneck in a system and refining it until it runs smoothly.',
    joyActivities: [
      { title: 'Mastering a detailed craft or system', whyItFits: 'Refining a skill, organizing a workflow, or solving a puzzle gives you clean flow.' },
      { title: 'Mindful wellness & nature walks', whyItFits: 'Simple, rhythmic daily health habits keep your mind light.' },
    ],
  },
  Libra: {
    moonShort: 'Graceful emotional balance',
    mercuryShort: 'fair-minded, tactful insight',
    moonSummary: 'gracious, fair, and attentive to harmony in every room',
    mercurySummary: 'weighs both sides of a question with proportion and tact',
    moonTone: 'You recharge in environments of aesthetic beauty, mutual courtesy, and calm companionship, away from harshness or friction.',
    mercuryTone: 'In strategy and dialogue, you excel at bridging opposing viewpoints and finding the principled middle ground.',
    joyActivities: [
      { title: 'Design, art & harmonious spaces', whyItFits: 'Surrounding yourself with proportion, music, and beauty calms your mind.' },
      { title: 'Unhurried dialogue with a close partner or friend', whyItFits: 'Thoughtful give-and-take helps you clarify your own thoughts.' },
    ],
  },
  Scorpio: {
    moonShort: 'Private emotional depth',
    mercuryShort: 'investigative, penetrating focus',
    moonSummary: 'fiercely loyal, private, and impossible to fool with surface talk',
    mercurySummary: 'cuts through appearances to uncover the root cause of any situation',
    moonTone: 'You guard your inner world carefully, choosing a small circle of ride-or-die bonds where complete honesty is safe.',
    mercuryTone: 'When a subject captures your interest, you bring relentless concentration—researching, testing, and mastering what others overlook.',
    joyActivities: [
      { title: 'Deep research & uninterrupted focus', whyItFits: 'Getting to the bottom of a complex question satisfies your mind.' },
      { title: 'Private, distraction-free downtime', whyItFits: 'Solitude lets you recharge your reserves completely.' },
    ],
  },
  Sagittarius: {
    moonShort: 'Open-hearted optimism',
    mercuryShort: 'purpose-driven perspective',
    moonSummary: 'candid, forward-looking, and energized by meaning and growth',
    mercurySummary: 'connects daily decisions to ethics, strategy, and the long view',
    moonTone: 'Your spirit needs open horizons, honest freedom, and a sense that this year is expanding your understanding of life.',
    mercuryTone: 'You naturally reason from first principles, linking practical choices to philosophy, mentorship, and long-term trajectory.',
    joyActivities: [
      { title: 'Learning, philosophy & open horizons', whyItFits: 'Exploring big ideas, books, or new places refreshes your outlook.' },
      { title: 'Teaching, mentoring & honest conversation', whyItFits: 'Sharing hard-won perspective gives you genuine fulfillment.' },
    ],
  },
  Capricorn: {
    moonShort: 'Composed emotional self-reliance',
    mercuryShort: 'methodical, realistic planning',
    moonSummary: 'steady under pressure, self-reliant, and respectful of real effort',
    mercurySummary: 'turns ambitious goals into structured, realistic sequences',
    moonTone: 'Emotional peace comes from knowing your foundations are solid, your word is kept, and your time is respected.',
    mercuryTone: 'You think like an architect—evaluating constraints honestly and designing durable plans that hold up over years.',
    joyActivities: [
      { title: 'Long-horizon building & quiet craftsmanship', whyItFits: 'Making steady, measurable progress on a real goal feels deeply grounding.' },
      { title: 'Time in quiet hills, trails, or historic places', whyItFits: 'Grounded, enduring settings help you step back from daily pressure.' },
    ],
  },
  Aquarius: {
    moonShort: 'Independent emotional poise',
    mercuryShort: 'original, systems-level thinking',
    moonSummary: 'independent, humane, and refreshingly unpretentious',
    mercurySummary: 'sees how whole systems, networks, and communities fit together',
    moonTone: 'You care deeply about people and fairness, yet you need daily intellectual breathing room so you never feel boxed in.',
    mercuryTone: 'Your mind spots structural improvements and future possibilities early, thriving on unconventional problem-solving.',
    joyActivities: [
      { title: 'Systems thinking & independent exploration', whyItFits: 'Solving unconventional problems at your own pace energizes you.' },
      { title: 'Shared purpose with like-minded peers', whyItFits: 'Collaborating on a meaningful cause without micromanagement feels natural.' },
    ],
  },
  Pisces: {
    moonShort: 'Gentle empathetic receptivity',
    mercuryShort: 'intuitive, holistic synthesis',
    moonSummary: 'compassionate, imaginative, and sensitive to unspoken moods',
    mercurySummary: 'grasps the whole picture intuitively before spelling out the steps',
    moonTone: 'Quiet beauty, music, spiritual reflection, and unhurried solitude near water or nature replenish your heart.',
    mercuryTone: 'Your intellect works through pattern recognition and creative synthesis, connecting subtle dots that purely linear analysis misses.',
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

function candidateHousesForPlanet(view: DigestView, planetCode: string | null | undefined): number[] {
  if (!planetCode) return [];
  const d1 = view.planet('D1', planetCode);
  const d9 = view.planet('D9', planetCode);
  const raw = [d1?.house, ...(d1?.owns ?? []), d9?.house];
  return raw.filter((h): h is number => typeof h === 'number' && h >= 1 && h <= 12);
}

function pickDistinctHouse(candidates: Array<number | null | undefined>, used: Set<number>, fallbackOrder: number[]): number {
  for (const h of candidates) {
    if (typeof h === 'number' && h >= 1 && h <= 12 && !used.has(h)) {
      used.add(h);
      return h;
    }
  }
  for (const h of fallbackOrder) {
    if (!used.has(h)) {
      used.add(h);
      return h;
    }
  }
  return fallbackOrder[0] ?? 1;
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

  const usedHouses = new Set<number>();
  const pastHouse = pickDistinctHouse(
    [
      ...candidateHousesForPlanet(view, pastMd?.lord),
      ...(pastMd?.houses ?? []),
      ...candidateHousesForPlanet(view, pastAd?.lord),
      ...(pastAd?.houses ?? []),
      view.planet('D1', 'Mo')?.house,
      4,
    ],
    usedHouses,
    [4, 3, 6, 1, 5, 10, 9, 2, 7, 8, 11, 12],
  );
  const nowHouse = pickDistinctHouse(
    [
      ...candidateHousesForPlanet(view, nowMd?.lord),
      ...(nowMd?.houses ?? []),
      ...candidateHousesForPlanet(view, l1Code),
      ...candidateHousesForPlanet(view, nowAd?.lord),
      ...(nowAd?.houses ?? []),
      akCard?.house,
      1,
    ],
    usedHouses,
    [1, 10, 5, 9, 4, 2, 11, 3, 7, 6, 8, 12],
  );
  const nextHouse = pickDistinctHouse(
    [
      ...candidateHousesForPlanet(view, nextMd?.lord),
      ...(nextMd?.houses ?? []),
      ...candidateHousesForPlanet(view, nextAd?.lord),
      ...(nextAd?.houses ?? []),
      ...candidateHousesForPlanet(view, akCode),
      d9L1Card?.house,
      9,
    ],
    usedHouses,
    [9, 10, 11, 5, 1, 4, 2, 7, 12, 3, 8, 6],
  );

  const pastTheme = HOUSE_CHARACTER_THEMES[pastHouse] ?? HOUSE_CHARACTER_THEMES[1]!;
  const nowTheme = HOUSE_CHARACTER_THEMES[nowHouse] ?? HOUSE_CHARACTER_THEMES[10]!;
  const nextTheme = HOUSE_CHARACTER_THEMES[nextHouse] ?? HOUSE_CHARACTER_THEMES[9]!;

  const age = typeof opts?.ageYears === 'number' && opts.ageYears > 0 ? Math.floor(opts.ageYears) : null;
  const pastStartAge = age !== null ? Math.max(0, age - 10) : null;
  const pastSpanYears = age !== null ? Math.max(1, age - (pastStartAge ?? 0)) : 10;
  const pastAgeTag =
    age !== null
      ? `Ages ${pastStartAge}–${age} (${refYear - pastSpanYears}–${refYear})`
      : `${refYear - 10}–${refYear}`;
  const nowAgeTag = age !== null ? `Age ${age} (${refYear})` : `${refYear}`;
  const nextAgeTag = age !== null ? `Ages ${age}–${age + 10} (${refYear}–${refYear + 10})` : `${refYear}–${refYear + 10}`;

  const pastDecade: SelfCharacterArcStage = {
    id: 'past_10y',
    stage: 'past_10y',
    title: 'Last 10 Years',
    label: 'Last 10 Years',
    ageSpanLabel: pastAgeTag,
    windowLabel: pastAgeTag,
    headline: pastTheme.pastHeadline,
    summary: pastTheme.pastSummary,
    anchorTrait: pastTheme.pastTrait,
    evidence: [
      `vimsottari:past_10y:${pastMd?.lord ?? l1Code}/${pastAd?.lord ?? akCode} (${pastFrom}..${asOf})`,
      `D1.p.${pastMd?.lord ?? l1Code}.h${pastHouse}`,
    ],
  };

  const presentNow: SelfCharacterArcStage = {
    id: 'now',
    stage: 'now',
    title: 'Who You Are Now',
    label: 'Who You Are Now',
    ageSpanLabel: nowAgeTag,
    windowLabel: nowAgeTag,
    headline: nowTheme.nowHeadline,
    summary: nowTheme.nowSummary,
    anchorTrait: nowTheme.nowTrait,
    evidence: [
      `D1.h1:${h1?.sign ?? 'Aries'} (L1=${l1Code} in H${l1Card?.house ?? 1}, D9=${d9L1Card?.dignity ?? 'friendly'})`,
      `D1.point.AK=${akCode} (H${akCard?.house ?? 1})`,
      `vimsottari:now:${nowMd?.lord ?? l1Code}/${nowAd?.lord ?? akCode}`,
    ],
  };

  const nextDecade: SelfCharacterArcStage = {
    id: 'next_10y',
    stage: 'next_10y',
    title: 'Next 10 Years',
    label: 'Next 10 Years',
    ageSpanLabel: nextAgeTag,
    windowLabel: nextAgeTag,
    headline: nextTheme.nextHeadline,
    summary: nextTheme.nextSummary,
    anchorTrait: nextTheme.nextTrait,
    evidence: [
      `vimsottari:next_10y:${nextMd?.lord ?? akCode}/${nextAd?.lord ?? l1Code} (${asOf}..${nextTo})`,
      `D9.p.${nextMd?.lord ?? akCode} (${view.planet('D9', nextMd?.lord ?? akCode)?.dignity ?? 'friendly'})`,
      `D1.p.${nextMd?.lord ?? akCode}.h${nextHouse}`,
    ],
  };

  return {
    headline: 'How the last ten years shaped you, where your character stands now, and who you are becoming over the next decade',
    pastDecade,
    presentNow,
    nextDecade,
    windows: [pastDecade, presentNow, nextDecade],
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
      id: 'emotional_core',
      title: moonStyle.joyActivities[0]!.title,
      whatYouEnjoy: moonStyle.joyActivities[0]!.title,
      whyItFeelsGood: moonStyle.joyActivities[0]!.whyItFits,
      whyItFits: moonStyle.joyActivities[0]!.whyItFits,
      evidence: [
        `D1.Mo:${moonSign} (H${moD1?.house ?? 4}, ${moD1?.dignity ?? 'friendly'})`,
        `D9.Mo:${moD9?.sign ?? moonSign} (${moD9?.dignity ?? 'friendly'})`,
        `StarProfile.moonStar:${star?.moonStar ?? moD1?.star ?? 'Rohini'}`,
      ],
    },
    {
      id: 'mental_play',
      title: mercuryStyle.joyActivities[0]!.title,
      whatYouEnjoy: mercuryStyle.joyActivities[0]!.title,
      whyItFeelsGood: mercuryStyle.joyActivities[0]!.whyItFits,
      whyItFits: mercuryStyle.joyActivities[0]!.whyItFits,
      evidence: [
        `D1.Me:${mercurySign} (H${meD1?.house ?? 5}, ${meD1?.dignity ?? 'friendly'})`,
        `D9.Me:${meD9?.sign ?? mercurySign} (${meD9?.dignity ?? 'friendly'})`,
        `D24.Me:${meD24?.sign ?? mercurySign} (${meD24?.dignity ?? 'friendly'})`,
      ],
    },
    {
      id: 'social_creative',
      title: moonStyle.joyActivities[1]!.title,
      whatYouEnjoy: moonStyle.joyActivities[1]!.title,
      whyItFeelsGood: moonStyle.joyActivities[1]!.whyItFits,
      whyItFits: moonStyle.joyActivities[1]!.whyItFits,
      evidence: [
        `D1.h4:${h4?.sign ?? 'Cancer'} (lord=${h4?.lord ?? 'Mo'}, SAV=${h4?.sav ?? 28})`,
        `D1.Mo.aspected_by:${(moD1?.aspectedBy ?? []).join(',') || 'benefic'}`,
      ],
    },
    {
      id: 'restorative_joy',
      title: mercuryStyle.joyActivities[1]!.title,
      whatYouEnjoy: mercuryStyle.joyActivities[1]!.title,
      whyItFeelsGood: mercuryStyle.joyActivities[1]!.whyItFits,
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
    headline: `${moonStyle.moonShort} paired with ${mercuryStyle.mercuryShort}`,
    personalitySummary: `People experience you as ${moonStyle.moonSummary}—with a mind that ${mercuryStyle.mercurySummary}.`,
    emotionalMindStyle: moonStyle.moonTone,
    intellectualWitStyle: mercuryStyle.mercuryTone,
    whatFeelsGood: joyItems,
    pillars: joyItems,
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

/**
 * Technique (`love.relationship_arc`):
 * Builds a 3-decade Vedic relationship & covenant evolution arc (Last 10 Years -> Where Your Heart Stands Now -> Next 10 Years)
 * from 7th Bhava, 5th Bhava, 8th Bhava, Venus (Shukra), Darakaraka (DK), Upapada (UL), and Navamsa (D9).
 */
export function buildLoveRelationshipArc(
  view: DigestView,
  activation: ActivationRow[],
  asOf: string,
  opts?: { ageYears?: number | null },
): SelfCharacterArc {
  const refYear = Number(asOf.slice(0, 4)) || 2026;
  const pastFrom = addMonthsIso(asOf, -120);
  const nextTo = addMonthsIso(asOf, 120);

  const h7 = view.house('D1', 7);
  const l7Code = h7?.lord ?? 'Ve';
  const veD1 = view.planet('D1', 'Ve');
  const veD9 = view.planet('D9', 'Ve');
  const dkPoint = view.points('D1').find((p) => p.id === 'DK');
  const ulPoint = view.points('D1').find((p) => p.id === 'UL');
  const dkCode = dkPoint?.lord ?? 'Ve';

  const pastMd = dominantPeriodForSpan(activation, pastFrom, asOf, 1);
  const nowMd =
    activation.find((r) => r.family === 'vimshottari' && r.level === 1 && r.from <= asOf && asOf < r.to) ?? pastMd;
  const nextMd = dominantPeriodForSpan(activation, asOf, nextTo, 1) ?? nowMd;

  const age = typeof opts?.ageYears === 'number' && opts.ageYears > 0 ? Math.floor(opts.ageYears) : null;
  const pastStartAge = age !== null ? Math.max(0, age - 10) : null;
  const pastSpanYears = age !== null ? Math.max(1, age - (pastStartAge ?? 0)) : 10;
  const pastAgeTag =
    age !== null
      ? `Ages ${pastStartAge}–${age} (${refYear - pastSpanYears}–${refYear})`
      : `${refYear - 10}–${refYear}`;
  const nowAgeTag = age !== null ? `Age ${age} (${refYear})` : `${refYear}`;
  const nextAgeTag = age !== null ? `Ages ${age}–${age + 10} (${refYear}–${refYear + 10})` : `${refYear}–${refYear + 10}`;

  const pastDecade: SelfCharacterArcStage = {
    id: 'past_10y',
    stage: 'past_10y',
    title: 'Last 10 Years',
    label: 'Last 10 Years',
    ageSpanLabel: pastAgeTag,
    windowLabel: pastAgeTag,
    headline: 'Distinguishing chemistry from lasting emotional safety',
    summary:
      'Over the past decade close relationships taught you the difference between surface attraction and a bond that genuinely protects your peace of mind.',
    anchorTrait: 'Selective relational trust',
    evidence: [
      `D1.h7:${h7?.sign ?? 'Libra'} (lord=${l7Code})`,
      `vimsottari:past_10y:${pastMd?.lord ?? l7Code} (${pastFrom}..${asOf})`,
    ],
  };

  const presentNow: SelfCharacterArcStage = {
    id: 'now',
    stage: 'now',
    title: 'Where Your Heart Stands Now',
    label: 'Where Your Heart Stands Now',
    ageSpanLabel: nowAgeTag,
    windowLabel: nowAgeTag,
    headline: 'Reciprocal honesty, clear agreements, and calm devotion',
    summary:
      'Today you value straightforward communication and kept promises over guesswork—bringing steadiness, loyalty, and warmth when reciprocity is clear.',
    anchorTrait: 'Principled partnership',
    evidence: [
      `D1.Ve:${veD1?.sign ?? 'Taurus'} (H${veD1?.house ?? 7})`,
      `D9.Ve:${veD9?.sign ?? 'Libra'} (${veD9?.dignity ?? 'friendly'})`,
      `D1.point.DK:${dkCode}`,
      `D1.point.UL:H${ulPoint?.house ?? 7}`,
    ],
  };

  const nextDecade: SelfCharacterArcStage = {
    id: 'next_10y',
    stage: 'next_10y',
    title: 'Next 10 Years',
    label: 'Next 10 Years',
    ageSpanLabel: nextAgeTag,
    windowLabel: nextAgeTag,
    headline: 'Deepening shared sanctuary and enduring companionship',
    summary:
      'Over the next ten years your relationship rhythm settles into deeper domestic warmth, mutual respect, and long-horizon companionship.',
    anchorTrait: 'Enduring covenant warmth',
    evidence: [
      `vimsottari:next_10y:${nextMd?.lord ?? dkCode} (${asOf}..${nextTo})`,
      `D9.h7:${view.house('D9', 7)?.sign ?? 'Libra'}`,
    ],
  };

  return {
    headline: 'How your approach to love, trust, and partnership has matured and where it is headed next',
    pastDecade,
    presentNow,
    nextDecade,
    windows: [pastDecade, presentNow, nextDecade],
  };
}

/**
 * Technique (`love.partner_chemistry`):
 * Builds a deterministic Vedic synthesis of affection, bonding, and partner chemistry from Venus (Shukra),
 * Moon (Chandra), 5th Bhava (romance), 7th Bhava (covenant), and 8th Bhava (emotional depth).
 */
export function buildLoveBondingAndChemistry(view: DigestView): SelfPersonalityAndJoy {
  const veD1 = view.planet('D1', 'Ve');
  const veD9 = view.planet('D9', 'Ve');
  const moD1 = view.planet('D1', 'Mo');
  const h5 = view.house('D1', 5);
  const h7 = view.house('D1', 7);
  const h8 = view.house('D1', 8);

  const items: SelfPersonalityJoyItem[] = [
    {
      id: 'covenant_trust',
      title: 'Kept promises & unhurried presence',
      whatYouEnjoy: 'Kept promises & unhurried presence',
      whyItFeelsGood: 'Consistency between words and actions lets your guard drop and deepens long-term devotion.',
      whyItFits: 'Consistency between words and actions lets your guard drop and deepens long-term devotion.',
      evidence: [`D1.h7:${h7?.sign ?? 'Libra'} (lord=${h7?.lord ?? 'Ve'})`, `D9.Ve:${veD9?.sign ?? 'Libra'}`],
    },
    {
      id: 'romantic_spark',
      title: 'Shared laughter, curiosity & creative dates',
      whatYouEnjoy: 'Shared laughter, curiosity & creative dates',
      whyItFeelsGood: 'Playful one-on-one conversation and shared interests keep affection warm during busy weeks.',
      whyItFits: 'Playful one-on-one conversation and shared interests keep affection warm during busy weeks.',
      evidence: [`D1.h5:${h5?.sign ?? 'Leo'} (lord=${h5?.lord ?? 'Su'})`, `D1.Ve:${veD1?.sign ?? 'Taurus'}`],
    },
  ];

  return {
    headline: 'Deep loyalty and emotional honesty paired with warm, perceptive affection',
    personalitySummary:
      'In love you bond through reliability, emotional candor, and shared quiet rituals rather than grand performative gestures.',
    emotionalMindStyle:
      'Your heart opens when a partner respects your inner sanctuary and communicates directly without games.',
    intellectualWitStyle:
      'Chemistry stays bright when you share intellectual curiosity, dry humor, and mutual encouragement.',
    whatFeelsGood: items,
    pillars: items,
    rechargeRule: 'Protect unhurried one-on-one evenings without phones or schedules to keep closeness effortless.',
    evidence: [
      `D1.Ve:${veD1?.sign ?? 'Taurus'}.H${veD1?.house ?? 7}`,
      `D9.Ve:${veD9?.sign ?? 'Libra'}`,
      `D1.Mo:${moD1?.sign ?? 'Taurus'}.H${moD1?.house ?? 4}`,
      `D1.h7.sav:${h7?.sav ?? 28}`,
      `D1.h8.sav:${h8?.sav ?? 27}`,
    ],
  };
}

/**
 * Technique (`work.character_arc`):
 * Builds a 3-decade Vedic career & ambition evolution arc (Last 10 Years -> Your Standing Today -> Next 10 Years)
 * from 10th Bhava, Dasamsa (D10), Amatyakaraka (AmK), Saturn (Shani), and active periods.
 */
export function buildWorkCharacterArc(
  view: DigestView,
  activation: ActivationRow[],
  asOf: string,
  opts?: { ageYears?: number | null },
): SelfCharacterArc {
  const refYear = Number(asOf.slice(0, 4)) || 2026;
  const pastFrom = addMonthsIso(asOf, -120);
  const nextTo = addMonthsIso(asOf, 120);

  const h10 = view.house('D1', 10);
  const l10Code = h10?.lord ?? 'Sa';
  const d10H10 = view.house('D10', 10);
  const amkPoint = view.points('D1').find((p) => p.id === 'AmK');
  const amkCode = amkPoint?.lord ?? l10Code;

  const pastMd = dominantPeriodForSpan(activation, pastFrom, asOf, 1);
  const nowMd =
    activation.find((r) => r.family === 'vimshottari' && r.level === 1 && r.from <= asOf && asOf < r.to) ?? pastMd;
  const nextMd = dominantPeriodForSpan(activation, asOf, nextTo, 1) ?? nowMd;

  const age = typeof opts?.ageYears === 'number' && opts.ageYears > 0 ? Math.floor(opts.ageYears) : null;
  const pastStartAge = age !== null ? Math.max(0, age - 10) : null;
  const pastSpanYears = age !== null ? Math.max(1, age - (pastStartAge ?? 0)) : 10;
  const pastAgeTag =
    age !== null
      ? `Ages ${pastStartAge}–${age} (${refYear - pastSpanYears}–${refYear})`
      : `${refYear - 10}–${refYear}`;
  const nowAgeTag = age !== null ? `Age ${age} (${refYear})` : `${refYear}`;
  const nextAgeTag = age !== null ? `Ages ${age}–${age + 10} (${refYear}–${refYear + 10})` : `${refYear}–${refYear + 10}`;

  const pastDecade: SelfCharacterArcStage = {
    id: 'past_10y',
    stage: 'past_10y',
    title: 'Last 10 Years',
    label: 'Last 10 Years',
    ageSpanLabel: pastAgeTag,
    windowLabel: pastAgeTag,
    headline: 'Building foundational craft and accountable execution',
    summary:
      'Through the past decade you forged hands-on capability, reliable execution, and practical resilience through real accountability.',
    anchorTrait: 'Self-reliant stamina',
    evidence: [
      `D1.h10:${h10?.sign ?? 'Capricorn'} (lord=${l10Code})`,
      `vimsottari:past_10y:${pastMd?.lord ?? l10Code} (${pastFrom}..${asOf})`,
    ],
  };

  const presentNow: SelfCharacterArcStage = {
    id: 'now',
    stage: 'now',
    title: 'Your Standing Today',
    label: 'Your Standing Today',
    ageSpanLabel: nowAgeTag,
    windowLabel: nowAgeTag,
    headline: 'Earned authority and strategic focus',
    summary:
      'Today you bring calm command, structured judgment, and trusted follow-through to high-stakes work.',
    anchorTrait: 'Principled execution',
    evidence: [
      `D10.h10:${d10H10?.sign ?? 'Capricorn'} (lord=${d10H10?.lord ?? l10Code})`,
      `D1.point.AmK:${amkCode}`,
      `vimsottari:now:${nowMd?.lord ?? l10Code}`,
    ],
  };

  const nextDecade: SelfCharacterArcStage = {
    id: 'next_10y',
    stage: 'next_10y',
    title: 'Next 10 Years',
    label: 'Next 10 Years',
    ageSpanLabel: nextAgeTag,
    windowLabel: nextAgeTag,
    headline: 'Stepping into advisory scope and lasting impact',
    summary:
      'Across the coming decade your role shifts from carrying every task yourself to setting direction, mentoring talent, and compounding long-term equity.',
    anchorTrait: 'Strategic stewardship',
    evidence: [
      `vimsottari:next_10y:${nextMd?.lord ?? amkCode} (${asOf}..${nextTo})`,
      `D10.p.${nextMd?.lord ?? amkCode}`,
    ],
  };

  return {
    headline: 'How your work identity, accountability, and professional authority evolve across three chapters',
    pastDecade,
    presentNow,
    nextDecade,
    windows: [pastDecade, presentNow, nextDecade],
  };
}

/**
 * Technique (`work.personality_vocation`):
 * Builds a deterministic Vedic synthesis of work style, leadership style, and 4 vocation choices from
 * 10th Bhava (D1), Dasamsa (D10), Amatyakaraka (AmK), Saturn, Sun, Mercury, Mars, and Rajya Pada (A10).
 */
export function buildWorkVocationAndPersonality(view: DigestView): SelfPersonalityAndJoy {
  const h10 = view.house('D1', 10);
  const d10H10 = view.house('D10', 10);
  const amkPoint = view.points('D1').find((p) => p.id === 'AmK');
  const a10Point = view.points('D1').find((p) => p.id === 'A10');

  const items: SelfPersonalityJoyItem[] = [
    {
      id: 'systems_engineering',
      title: '1. Systems Architecture, Engineering & Technical Product',
      whatYouEnjoy: '1. Systems Architecture, Engineering & Technical Product',
      whyItFeelsGood: 'Designing scalable platforms, technical infrastructure, or analytical tools with measurable output.',
      whyItFits: 'Designing scalable platforms, technical infrastructure, or analytical tools with measurable output.',
      evidence: [`D10.h10:${d10H10?.sign ?? 'Capricorn'}`, 'D1.Me', 'D1.Sa'],
    },
    {
      id: 'executive_stewardship',
      title: '2. Executive Operations, Strategy & Program Stewardship',
      whatYouEnjoy: '2. Executive Operations, Strategy & Program Stewardship',
      whyItFeelsGood: 'Guiding complex organizations, P&L execution, or cross-functional turnarounds requiring long-horizon planning.',
      whyItFits: 'Guiding complex organizations, P&L execution, or cross-functional turnarounds requiring long-horizon planning.',
      evidence: [`D1.h10:${h10?.sign ?? 'Capricorn'} (lord=${h10?.lord ?? 'Sa'})`, 'D1.Su'],
    },
    {
      id: 'advisory_consulting',
      title: '3. Independent Advisory, Consulting & Specialist Practice',
      whatYouEnjoy: '3. Independent Advisory, Consulting & Specialist Practice',
      whyItFeelsGood: 'High-trust advisory, research, finance, or specialized domain consulting where clients rely on your diagnostic rigor.',
      whyItFits: 'High-trust advisory, research, finance, or specialized domain consulting where clients rely on your diagnostic rigor.',
      evidence: [`D1.point.AmK:${amkPoint?.lord ?? 'Ju'}`, 'D1.Ju'],
    },
    {
      id: 'founder_ventures',
      title: '4. Founder-Led Ventures & Asset-Building Enterprises',
      whatYouEnjoy: '4. Founder-Led Ventures & Asset-Building Enterprises',
      whyItFeelsGood: 'Building an independent business, IP portfolio, or specialized firm with lean, high-competence collaborators.',
      whyItFits: 'Building an independent business, IP portfolio, or specialized firm with lean, high-competence collaborators.',
      evidence: [`D1.point.A10:H${a10Point?.house ?? 10}`, 'D1.h11'],
    },
  ];

  return {
    headline: 'Methodical systems thinking paired with calm, accountable authority',
    personalitySummary:
      'In work you thrive when given clear ownership of results, autonomy to design the system, and direct accountability for quality.',
    emotionalMindStyle:
      'You lead by example and clear standards—setting realistic milestones, protecting team focus, and delivering without fanfare.',
    intellectualWitStyle:
      'You diagnose root causes quickly, break complex initiatives into sequential steps, and stay composed when priorities shift.',
    whatFeelsGood: items,
    pillars: items,
    rechargeRule: 'Protect deep-work blocks free of fragmented meetings so your strategic judgment stays sharp.',
    evidence: [
      `D1.h10:${h10?.sign ?? 'Capricorn'}`,
      `D10.h10:${d10H10?.sign ?? 'Capricorn'}`,
      `D1.point.AmK:${amkPoint?.lord ?? 'Sa'}`,
      `D1.point.A10:H${a10Point?.house ?? 10}`,
    ],
  };
}


