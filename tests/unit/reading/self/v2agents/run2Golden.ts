/**
 * Golden Personalizer outputs for the three run 2 profiles (docs/reading-engine/66-replay-2026-11-09-self-v2-run2.md),
 * written by hand on the run 2 Oracle document (docs/reading-engine/replays/66-2026-11-09-run2/c584c0a3-oracle.json) as
 * the strengthened prompt asks: the profile shapes the card (band, work status and level, love, focus), no invented
 * career stage, focus first on the Now cards, the hero question on its claim's own matter. Mocked model output: no model
 * was called. The distinctness test measures these against each other.
 */
type Card = {
  areaId: string;
  headline: string;
  body: string[];
  patterns: Array<{ text: string; kind: string; since: string; until: string; source: string }>;
  ladder: { best: string; practical: string; drift: string; floor: string };
  dates: Array<{ from: string; to: string; label: string }>;
  sources: string[];
};
export type GoldenDoc = { hero: Record<string, unknown>; cards: Card[] };

const HEAVY = 'claim:stuck.heaviest_now:presses:ideas_and_children+luck_and_belief+gains_and_network';
const NOW = { from: '2026-11-05', to: '2026-12-12' };
const SUB = { from: '2026-05-05', to: '2026-12-12' };
const MAIN = { from: '2023-10-23', to: '2034-10-22' };

/** a: woman, 25–35, own business with staff, single, focus career and money */
export const GOLDEN_A: GoldenDoc = {
  hero: {
    tone: 'heavy',
    sentence: 'Your business and money ask for patience until 12 Dec 2026.',
    sub: 'Hold steady now; push for growth after that date.',
    questionClaimId: HEAVY,
    questionText: 'Since 5 Nov 2026, have new ideas and your wider circle of friends felt flat?',
    withheld: false,
  },
  cards: [
    {
      areaId: 'stuck',
      headline: 'Until 12 Dec 2026, you may pull back from your team and new ideas.',
      body: [
        'Since 5 Nov 2026 the business may have felt flatter to you, and fresh plans for growth seem less exciting. You may doubt contacts who could bring customers or cash.',
        'This is a short dip, not a verdict on the company you are building. It lifts on 12 Dec 2026; keep hiring and big spending decisions small until then.',
      ],
      patterns: [{ text: 'You go quiet with the people who could open doors for the business.', kind: 'risk', since: NOW.from, until: NOW.to, source: 'stuck.p1' }],
      ladder: {
        best: 'Tell your team plainly that you are thinking, not pulling away.',
        practical: 'Keep one call a week with a customer or a lender on the calendar.',
        drift: 'Let it ride and good contacts cool off for a few weeks.',
        floor: 'Protect cash and payroll; postpone anything optional.',
      },
      dates: [{ ...NOW, label: 'A flat few weeks in the business' }],
      sources: ['stuck.p1', 'stuck.p1', 'stuck.p1', 'stuck.p2', 'stuck.p2'],
    },
    {
      areaId: 'chapter',
      headline: 'Your push to secure cash and customers wraps up by 12 Dec 2026.',
      body: [
        'Since May you have been building security for the business by hand: chasing payments, guarding margins, taking on more yourself. That effort is what has held things steady.',
        'Use the weeks to 12 Dec 2026 to close open invoices and clear loose ends. Start the next big push after that date, not before.',
      ],
      patterns: [],
      ladder: {
        best: 'Finish what you started and thank the people who carried it with you.',
        practical: 'Chase every open invoice and sign the agreements still on your desk.',
        drift: 'Leave things open and the next stretch starts with old clutter.',
        floor: 'Keep enough cash on hand for three months of costs.',
      },
      dates: [{ ...SUB, label: 'Your stretch of hands-on building' }],
      sources: ['chapter.p1', 'chapter.p1', 'chapter.p2', 'chapter.p2', 'chapter.p2'],
    },
    {
      areaId: 'drive',
      headline: 'You build money through sharp, detailed work and bold calls.',
      body: [
        'Your drive is to turn what you know into income, and you are at your best on exacting, detailed work. Staff and customers feel that standard.',
        'Through 2034 the years favour building the firm’s name and its partnerships. Right now the effort goes into securing cash before you widen the business.',
      ],
      patterns: [],
      ladder: {
        best: 'Put your name to work you are proud of and let it sell itself.',
        practical: 'Price for the detail you deliver; do not discount it away.',
        drift: 'Spread yourself across too many offers and the edge blurs.',
        floor: 'Keep your best customers served first, whatever else waits.',
      },
      dates: [{ ...MAIN, label: 'Your long building years' }],
      sources: ['drive.p1', 'drive.p1', 'drive.p2', 'drive.p3', 'drive.p3'],
    },
    {
      areaId: 'chapters',
      headline: 'These are your building years for the business, running to 2034.',
      body: [
        'Since 2023 you have been in a long stretch that rewards learning fast and being seen. It suits a founder in her first decade: say yes to visibility, partnerships and contracts that grow the company.',
        'Before 2023 you were learning how agreements and obligations really work. After 2034 the focus turns to refining what you have built.',
      ],
      patterns: [],
      ladder: {
        best: 'Grow the company in the open, with partners you trust.',
        practical: 'Put every partnership in writing before it starts.',
        drift: 'Stay small and quiet and the long stretch gives less than it could.',
        floor: 'Never sign what you have not read twice.',
      },
      dates: [{ ...MAIN, label: 'Your building years' }],
      sources: ['chapters.p2', 'chapters.p2', 'chapters.p2', 'chapters.p1', 'chapters.p3'],
    },
    {
      areaId: 'body',
      headline: 'Long days run you hot and dry; pace and rest keep you steady.',
      body: [
        'Your footing is sound, but running the business on long days builds heat and tension in you. Stress shows up in the body fast.',
        'Until 12 Dec 2026 heat is the thing to watch. Keep a fixed finish time and one real day off each week.',
      ],
      patterns: [],
      ladder: {
        best: 'Set a hard stop to the working day and keep it.',
        practical: 'Book rest into the calendar the way you book customers.',
        drift: 'Push through and the tension stays in your shoulders and sleep.',
        floor: 'Sleep seven hours, whatever the business needs that week.',
      },
      dates: [{ ...NOW, label: 'A stretch to slow down' }],
      sources: ['body.p3', 'body.p1', 'body.p1', 'body.p3', 'body.p3'],
    },
    {
      areaId: 'lagna',
      headline: 'You think deeply and want your word to count with everyone you deal with.',
      body: [
        'Inside you are reflective and fair; you weigh things before you commit. Partners, customers and staff bring out who you are.',
        'People see more authority in you than you feel. Use it: a clear word from you settles a room.',
      ],
      patterns: [],
      ladder: {
        best: 'Lead from your values and say them out loud.',
        practical: 'Put your commitments in writing so others can rely on them.',
        drift: 'Keep your thinking private and people guess at what you want.',
        floor: 'Keep your word, even on small things.',
      },
      dates: [],
      sources: ['lagna.p1', 'lagna.p1', 'lagna.p1', 'lagna.p2', 'lagna.p2'],
    },
  ],
};

/** b: man, 46–60, employed senior leader, married, grown children, focus career and family */
export const GOLDEN_B: GoldenDoc = {
  hero: {
    tone: 'heavy',
    sentence: 'Work and family ask more of you until 12 Dec 2026.',
    sub: 'Close what is open; the pressure lifts after that date.',
    questionClaimId: HEAVY,
    questionText: 'Since 5 Nov 2026, have you felt cooler toward friends and new ideas?',
    withheld: false,
  },
  cards: [
    {
      areaId: 'stuck',
      headline: 'Until 12 Dec 2026 you may hold back at work and at home.',
      body: [
        'Since 5 Nov 2026 you may have felt cooler toward your wider circle and slower to back new ideas from your people. You weigh every move twice.',
        'With your wife and grown children, say what is on your mind instead of going quiet. The pull inward eases on 12 Dec 2026.',
      ],
      patterns: [{ text: 'You go silent at home when work presses hardest.', kind: 'risk', since: NOW.from, until: NOW.to, source: 'stuck.p1' }],
      ladder: {
        best: 'Name the doubt to your wife before it turns into distance.',
        practical: 'Give your direct reports a date for the decisions you are holding.',
        drift: 'Let it ride and both the team and the family wait on you.',
        floor: 'Keep the family dinner and the weekly team meeting, whatever else moves.',
      },
      dates: [{ ...NOW, label: 'A quieter few weeks' }],
      sources: ['stuck.p1', 'stuck.p1', 'stuck.p2', 'stuck.p2', 'stuck.p2'],
    },
    {
      areaId: 'chapter',
      headline: 'Settle what you started this year before 12 Dec 2026.',
      body: [
        'Since May the work has asked you to secure results personally rather than delegate them. Decisions that protect what the organisation has built land well.',
        'Before 12 Dec 2026, close open decisions and hand over what others can carry. Leave new commitments for after that date.',
      ],
      patterns: [],
      ladder: {
        best: 'Close the year’s big decisions yourself and credit the people who delivered.',
        practical: 'List what is still open and assign an owner and a date to each.',
        drift: 'Carry it all into the new year and start tired.',
        floor: 'Protect the results already won; take no new risks before the date.',
      },
      dates: [{ ...SUB, label: 'A stretch of hands-on results' }],
      sources: ['chapter.p2', 'chapter.p1', 'chapter.p1', 'chapter.p2', 'chapter.p2'],
    },
    {
      areaId: 'drive',
      headline: 'Your standing rests on judgment and careful follow-through.',
      body: [
        'Your drive now is to consolidate: protect the gains, set the standard and choose who carries the work forward. Precision is still your edge.',
        'Through 2034 your standing and alliances keep growing. It is a fair time to plan succession and mentor the people who will take over.',
      ],
      patterns: [],
      ladder: {
        best: 'Build the people who will run things after you.',
        practical: 'Write down how the key decisions are made, so others can make them.',
        drift: 'Keep everything in your own hands and the organisation leans on you too long.',
        floor: 'Guard your reputation: no shortcuts on quality or on promises.',
      },
      dates: [{ ...MAIN, label: 'Your years of standing' }],
      sources: ['drive.p1', 'drive.p1', 'drive.p2', 'drive.p3', 'drive.p3'],
    },
    {
      areaId: 'chapters',
      headline: 'These years to 2034 put your judgment and name in plain view.',
      body: [
        'Since 2023 your role has made your decisions more visible, inside the company and at home. The family looks to you for steadiness as the children make their own way.',
        'Before that, you spent years learning how obligations and agreements really bind. After 2034 the work turns to refining what you hand on.',
      ],
      patterns: [],
      ladder: {
        best: 'Use the visibility to stand for something you will be glad to be known for.',
        practical: 'Plan the next ten years at work and at home side by side.',
        drift: 'Let others define your name and it settles on whatever is loudest.',
        floor: 'Keep your promises to the family as firmly as the ones at work.',
      },
      dates: [{ ...MAIN, label: 'Your years in view' }],
      sources: ['chapters.p2', 'chapters.p2', 'chapters.p2', 'chapters.p1', 'chapters.p3'],
    },
    {
      areaId: 'body',
      headline: 'Stamina holds when you pace the week and guard your joints.',
      body: [
        'Your constitution is steady, but long weeks of decisions build tension you carry in the body. Stress costs you more now than it did ten years ago.',
        'Until 12 Dec 2026 heat and strain are the risks. Walk daily, keep a regular bedtime and take the stairs slowly.',
      ],
      patterns: [],
      ladder: {
        best: 'Treat recovery as part of the job, not a reward after it.',
        practical: 'Put a daily walk and a fixed bedtime on the calendar.',
        drift: 'Push through and the strain settles in your back and knees.',
        floor: 'Never skip sleep two nights running.',
      },
      dates: [{ ...NOW, label: 'Weeks to pace yourself' }],
      sources: ['body.p3', 'body.p1', 'body.p1', 'body.p3', 'body.p3'],
    },
    {
      areaId: 'lagna',
      headline: 'Inside you weigh things quietly; outside people read authority and resolve.',
      body: [
        'You are reflective and principled, and your marriage and closest alliances show you who you are. You hold yourself to exact commitments.',
        'Colleagues and the board see an established leader. Keep that trust by staying plain and consistent in public.',
      ],
      patterns: [],
      ladder: {
        best: 'Let your values lead the decisions people see.',
        practical: 'Say what you will do, then do exactly that.',
        drift: 'Hide the thinking and people mistake caution for distance.',
        floor: 'Never let the public role cost you the trust at home.',
      },
      dates: [],
      sources: ['lagna.p2', 'lagna.p1', 'lagna.p1', 'lagna.p2', 'lagna.p2'],
    },
  ],
};

/** c: gender not stated, 60+, retired, focus health and spirituality */
export const GOLDEN_C: GoldenDoc = {
  hero: {
    tone: 'heavy',
    sentence: 'Your health and inner life ask for rest until 12 Dec 2026.',
    sub: 'A quieter, inward stretch that lifts after that date.',
    questionClaimId: HEAVY,
    questionText: 'Since 5 Nov 2026, has your faith or your circle of friends felt further away?',
    withheld: false,
  },
  cards: [
    {
      areaId: 'stuck',
      headline: 'Until 12 Dec 2026 you may withdraw from friends and quiet practice.',
      body: [
        'Since 5 Nov 2026 you may feel less drawn to your circle and to the creative things you enjoy. Doubt can creep into your faith too.',
        'This is a passing inward turn, and it lifts on 12 Dec 2026. Keep one gathering and one daily prayer or sitting, even when you would rather skip them.',
      ],
      patterns: [{ text: 'You stay home from the people and practices that lift you.', kind: 'risk', since: NOW.from, until: NOW.to, source: 'stuck.p1' }],
      ladder: {
        best: 'Keep your daily practice short and steady rather than skipping it.',
        practical: 'Say yes to one visit with a friend each week.',
        drift: 'Let it ride and the quiet turns into loneliness for a while.',
        floor: 'Keep your morning routine and one call to someone you love.',
      },
      dates: [{ ...NOW, label: 'A quieter, inward stretch' }],
      sources: ['stuck.p1', 'stuck.p1', 'stuck.p1', 'stuck.p2', 'stuck.p2'],
    },
    {
      areaId: 'chapter',
      headline: 'Finish what you began for your health and home before 12 Dec 2026.',
      body: [
        'Since May the season has asked you to put your own effort into security: your home, your savings and your routines. Steady effort, not luck, has carried it.',
        'Use the weeks to 12 Dec 2026 to tie up small matters and clear the mind. Begin new projects after that.',
      ],
      patterns: [],
      ladder: {
        best: 'Finish the home and health routines you started this year.',
        practical: 'Sort the papers and small repairs that have waited.',
        drift: 'Leave things half done and they weigh on the mind.',
        floor: 'Keep your savings untouched until the new year.',
      },
      dates: [{ ...SUB, label: 'A stretch of steady effort' }],
      sources: ['chapter.p1', 'chapter.p1', 'chapter.p2', 'chapter.p2', 'chapter.p2'],
    },
    {
      areaId: 'drive',
      headline: 'What drives you now is meaning, care and things done well.',
      body: [
        'Your old precision has not gone; it now goes into the projects you choose and the people you care for. You like to see a thing through properly.',
        'Through 2034 the years favour your good name and the bonds you keep. Put effort where it serves your health and your inner life first.',
      ],
      patterns: [],
      ladder: {
        best: 'Give your care to one project that means something to you.',
        practical: 'Choose the two commitments that matter and let the rest go.',
        drift: 'Say yes to everything and the days fill without meaning.',
        floor: 'Keep time each day for your own practice.',
      },
      dates: [{ ...MAIN, label: 'Years that honour your name' }],
      sources: ['drive.p2', 'drive.p2', 'drive.p1', 'drive.p3', 'drive.p3'],
    },
    {
      areaId: 'chapters',
      headline: 'These are years of wisdom and quiet standing, running to 2034.',
      body: [
        'Since 2023 you have been in a long, good stretch for wisdom and for being sought out. Family and community come to you for counsel.',
        'Before that, you spent years settling obligations. After 2034 life turns gently toward rest and refinement.',
      ],
      patterns: [],
      ladder: {
        best: 'Share what you have learned with those who ask.',
        practical: 'Make one regular place where people can find you.',
        drift: 'Keep to yourself and the wisdom stays unused.',
        floor: 'Keep your counsel kind and your promises small.',
      },
      dates: [{ ...MAIN, label: 'Your years of wisdom' }],
      sources: ['chapters.p2', 'chapters.p2', 'chapters.p2', 'chapters.p1', 'chapters.p3'],
    },
    {
      areaId: 'body',
      headline: 'Your energy holds with gentle pacing, warmth kept in check and rest.',
      body: [
        'Your footing is steady, and a calm routine is what keeps it so. Worry shows quickly as tension in the body.',
        'Until 12 Dec 2026 too much heat and hurry wear on you. Move gently each morning, rest after midday and keep evenings quiet.',
      ],
      patterns: [],
      ladder: {
        best: 'Make rest part of the day, not something you earn.',
        practical: 'Walk gently each morning and lie down after midday.',
        drift: 'Hurry through the days and the tension settles in.',
        floor: 'Keep the same bedtime every night.',
      },
      dates: [{ ...NOW, label: 'Weeks for gentle pacing' }],
      sources: ['body.p1', 'body.p1', 'body.p1', 'body.p3', 'body.p3'],
    },
    {
      areaId: 'lagna',
      headline: 'You are reflective and principled, and others trust your word.',
      body: [
        'Your nature is contemplative and kind, shaped by the people closest to you. You keep your commitments exactly.',
        'Others see a person of dignity whose counsel carries weight. Your inner life is where you are most yourself.',
      ],
      patterns: [],
      ladder: {
        best: 'Let your quiet faith guide how you spend your days.',
        practical: 'Keep the few commitments you make, exactly.',
        drift: 'Hold back your view and others miss your counsel.',
        floor: 'Keep your word, even on small things.',
      },
      dates: [],
      sources: ['lagna.p1', 'lagna.p1', 'lagna.p1', 'lagna.p2', 'lagna.p3'],
    },
  ],
};

export const GOLDEN = { a: GOLDEN_A, b: GOLDEN_B, c: GOLDEN_C } as const;
