/**
 * Who reads each board-build agent's output (docs/techniques/09 §3, §5; AGENTS.md "Reading depth is a release gate",
 * rule 2: nothing is dropped upward). One row per model agent of the board build: the next layer that reads its
 * output, or the served field that shows it. An agent kept only behind a flag until the paid replay passes is marked
 * `legacy` with what retires it (doc 09 §8 step 13). `tests/unit/reading/noDroppedOutputs.test.ts` fails on a
 * registered build agent with no row, a row with no consumer, or a consumer that is not a registered agent or a served
 * field.
 */

/** a served field the web renders (`servedFieldsRendered` in the web repo proves it has a place on screen) */
export type ServedField = `served:${string}`;

export interface AgentConsumers {
  /** the agents that read this output, or the served fields that show it */
  consumers: ReadonlyArray<string | ServedField>;
  /** what reaches them, in plain words */
  what: string;
  /** kept behind its flag until the depth replay passes; retired then */
  legacy?: { retireWhen: string };
}

/** the registry sub-modules that make up a board build (llm agents in them must each have a row) */
export const BOARD_BUILD_SUBMODULES: readonly string[] = ['family', 'lineman', 'cards', 'clocks', 'v2', 'v3', 'lens', 'now'];

export const PIPELINE_CONSUMERS: Readonly<Record<string, AgentConsumers>> = {
  'family.rasi': { consumers: ['lineman.self', 'lineman.love', 'lineman.work', 'self.card.oracle', 'self.oracle.v2'], what: 'keyed D1 findings (from the lagna), stored in reading_findings_cache' },
  'family.moon': { consumers: ['lineman.self', 'lineman.love', 'lineman.work', 'self.card.oracle'], what: 'keyed findings with the houses read from the Moon' },
  'family.star': { consumers: ['lineman.self', 'lineman.love', 'lineman.work', 'self.card.oracle'], what: 'keyed star, star lord and pada findings per planet' },
  'family.varga': { consumers: ['lineman.self', 'lineman.love', 'lineman.work', 'self.card.oracle', 'self.oracle.v2'], what: 'keyed D9 and routed divisional findings' },
  'family.dasha': { consumers: ['lineman.self', 'lineman.love', 'lineman.work', 'self.card.oracle', 'self.oracle.v2'], what: 'keyed findings on the verified dasha systems' },
  'family.year': { consumers: ['lineman.self', 'lineman.love', 'lineman.work', 'self.card.oracle', 'self.oracle.v2'], what: 'keyed findings on this and last Tithi Pravesha year' },
  'family.sky': { consumers: ['lineman.self', 'lineman.love', 'lineman.work', 'self.card.oracle', 'self.oracle.v2'], what: 'keyed transit findings' },
  'reading.clock': { consumers: ['lineman.self', 'lineman.love', 'lineman.work', 'self.card.oracle'], what: 'clock sheets: per span and matter a tone, a sentence and keys (the sentences reach the lens linemen; the tones the code count)' },
  'reading.concordance': { consumers: ['self.card.oracle'], what: 'the agreed ledger words (settled sentences, contested sides)', legacy: { retireWhen: 'the depth replay passes on the lens-thread cards (doc 09 §8 step 13)' } },
  'lineman.self': { consumers: ['self.card.oracle'], what: 'the lens thread for a Self lens: promise, period, year, star, trigger with keys' },
  'lineman.love': { consumers: ['self.card.oracle'], what: 'the lens thread for a Love lens' },
  'lineman.work': { consumers: ['self.card.oracle'], what: 'the lens thread for a Work lens' },
  'self.card.oracle': { consumers: ['self.card.personalizer', 'served:v3.story', 'served:v3.chart', 'served:v3.systems'], what: 'the technical story, its beat index, headline, stretches, gift, knot, confirm, certainty, evidence' },
  'self.card.personalizer': { consumers: ['served:v3.plain.story', 'served:v3.line', 'served:v3.spans', 'served:v3.ladder', 'served:v3.why', 'served:v3.confirm'], what: 'the plain story and the guaranteed fields' },
  'self.oracle.v2': { consumers: ['self.personalizer', 'served:v2.details'], what: 'the v2 area paragraphs (portrait and v2 cards)', legacy: { retireWhen: 'the depth replay passes; the Self hero line moves to the diagnosis card Personalizer' } },
  'self.personalizer': { consumers: ['served:v2.card'], what: 'the v2 cards (the you board falls back to them)', legacy: { retireWhen: 'the depth replay passes' } },
  'self.oracle.v3': { consumers: ['self.personalizer', 'served:v3.chart'], what: 'the three-call v3 cards (only when the per-card reading is off)', legacy: { retireWhen: 'the per-card reading is on everywhere' } },
  'self.now': { consumers: ['served:now'], what: 'the Now card' },
  'card.chat': { consumers: ['served:card_chat.answer'], what: 'a streamed answer about one card' },
};

/** every consumer named in the table that is an agent id (not a served field) */
export function consumerAgents(): string[] {
  return [...new Set(Object.values(PIPELINE_CONSUMERS).flatMap((c) => c.consumers).filter((c) => !c.startsWith('served:')))].sort();
}
