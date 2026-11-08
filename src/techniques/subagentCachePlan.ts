/**
 * Bridges decoupled technique pieces (`src/techniques/pieces.ts`) with per-sub-agent digest slicing
 * (`src/reading/oracle/digestSlices.ts`), LLM context cache uploads (`llm_cache_entries` / Gemini
 * `cachedContents`), cross-Lambda findings caching (`reading_findings_cache`), and date-range digested
 * technique outputs (`technique_outputs`).
 *
 * Answers two operational questions for every technique in `TECHNIQUES`:
 *   1. What decoupled pieces (`reader:<section>/<layout>`, `prompt:<system>`, `output:<schema>`) are
 *      pushed into the LLM Context Cache (`llm_cache_entries`) and/or pre-computed into
 *      `reading_findings_cache` / `technique_outputs` before the request so sub-agents never pull raw
 *      `kundli_data` live from PostgreSQL during the user's request?
 *   2. Which background and pre-run processes prepare the digest, upload the LLM prefix cache, pre-run
 *      the sub-agents, serve the request, and recycle per-individual caches after 45 minutes of
 *      inactivity?
 *
 * Nothing here computes anything astrological.
 */
import type { ActivationRow } from '../reading/digest/activation.js';
import type { DigestView } from '../reading/digest/types.js';
import { CORE_TYPES } from '../reading/oracle/chartBundle.js';
import {
  sliceDigestForSubAgent,
  SUBAGENT_DIGEST_SPECS,
  type SubAgentDigestSpec,
  type SubAgentId,
} from '../reading/oracle/digestSlices.js';
import type { PersonFrame } from '../reading/oracle/readers.js';
import { renderCore } from '../reading/oracle/slices.js';
import { TECHNIQUES, techniqueById, type TechniqueDef } from './catalog.js';
import {
  recipeOf,
  techniqueCacheKey,
  validityWindow,
  type Freshness,
  type ReaderUse,
  type ReuseScope,
  type TechniqueRecipe,
  type ValidityContext,
  type ValidityWindow,
} from './pieces.js';

export type PieceId = string;

export type LlmCacheStoreKind =
  | 'gemini_cached_contents+llm_cache_entries'
  | 'system_prompt_only'
  | 'none_deterministic_code';

export type OutputCacheTableKind =
  | 'reading_findings_cache+technique_outputs'
  | 'reading_findings_cache'
  | 'technique_outputs'
  | 'kundli_digest+kundli_activation'
  | 'day_tables+kundli_day_overlays'
  | 'area_builds+technique_outputs'
  | 'request_ephemeral';

export interface TechniqueLlmCacheUploadSpec {
  /** True when the technique invokes an LLM sub-agent that benefits from context/prefix caching. */
  usesLlmCache: boolean;
  /** Where the LLM prompt/context prefix is stored. */
  cacheStore: LlmCacheStoreKind;
  /** Deterministic key formula used in `llm_cache_entries` (or `'none'`). */
  cacheKeyFormula: string;
  /** The reusable `prompt:<system>` piece uploaded as the system instruction. */
  systemPromptPiece: PieceId | null;
  /** The decoupled `reader:<section>/<layout>` pieces serialized into the cached prefix from `kundli_digest`. */
  cachedPrefixReaderPieces: PieceId[];
  /** Digest sections sliced into the sub-agent's context from `kundli_digest` + `kundli_activation` (zero `kundli_data` DB pulls). */
  digestSections: Array<'house' | 'planet' | 'yoga' | 'point' | 'annual' | 'star' | 'activation'>;
  /** Dynamic per-request user fields sent as the lightweight suffix after the cached prefix. */
  perRequestSuffixFields: string[];
  /** Explicit Gemini `cachedContents` TTL in seconds (0 when no explicit Gemini cache is created). */
  ttlSeconds: number;
}

export interface TechniqueOutputCacheSpec {
  /** Which database table(s) persist the pre-computed or read-through output of this technique. */
  primaryTable: OutputCacheTableKind;
  /** Deterministic key formula for the output / findings cache row. */
  cacheKeyFormula: string;
  /** Freshness tier derived from the slowest-changing reader piece (`natal` -> `question`). */
  freshness: Freshness;
  /** Reuse scope (`kundli` across all questions/boards vs `question` for a specific turn). */
  scope: ReuseScope;
  /** Reusable `output:<schema>` piece returned by the technique. */
  outputPiece: PieceId;
  /** True when `recycleIndividualCaches` (45m inactivity sweep) evicts & recycles this kundli's cache rows. */
  recycledEvery45m: boolean;
}

export interface TechniqueSupportingProcesses {
  /** Background processes that build the deterministic inputs (`kundli_digest`, `kundli_activation`, `day_tables`). */
  preRunDataPreparation: string[];
  /** Pre-run processes that upload LLM context caches (`llm_cache_entries`) and pre-run sub-agents during Clarify / board warmups. */
  preRunCacheUploadAndWarm: string[];
  /** Request-path processes that consume the pre-uploaded LLM `cachedContent` handle and cached findings/outputs. */
  liveRequestExecution: string[];
  /** Scheduled sweep and event-driven invalidation processes (`recycleIndividualCaches`, `sweepExpiredCaches`, `deleteKundliTechniqueOutputs`). */
  invalidationAndRecycleSweep: string[];
}

export interface TechniqueSubAgentCachePlan {
  techniqueId: string;
  title: string;
  board: TechniqueDef['board'];
  category: TechniqueDef['category'];
  status: TechniqueDef['status'];
  recipe: TechniqueRecipe;
  /** Mapped sub-agent IDs in `SUBAGENT_DIGEST_SPECS` (`R01..R14`, `P1..P3`, `specialist:*`, `code:*`, `oracle`, etc.). */
  subAgents: SubAgentId[];
  /** Detailed digest slice specifications for each mapped sub-agent. */
  subAgentSpecs: SubAgentDigestSpec[];
  /** What gets pushed to the LLM Context Cache (`llm_cache_entries`) pre-run. */
  llmCacheUpload: TechniqueLlmCacheUploadSpec;
  /** What gets stored in `reading_findings_cache` (`M35/M38`) and/or `technique_outputs` (`M37`). */
  outputCache: TechniqueOutputCacheSpec;
  /** Processes supporting pre-run data preparation, LLM cache upload, sub-agent execution, and 45m recycling. */
  processes: TechniqueSupportingProcesses;
}

const ALL_ORACLE_READER_SUBAGENTS: SubAgentId[] = [
  'R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12', 'R13', 'R14',
  'P1', 'P2', 'P3',
];

const TECHNIQUE_TO_SUBAGENTS: Readonly<Record<string, SubAgentId[]>> = {
  'general.promise': ['specialist:promise'],
  'general.dasha': ['specialist:dasha'],
  'general.transit': ['specialist:transit'],
  'general.nakshatra': ['specialist:nakshatra', 'code:nakshatra'],
  'general.annual': ['specialist:annual', 'code:annual'],
  'general.prashna': ['specialist:prashna'],
  'general.varga_dynamics': ['code:varga_dynamics', 'code:varga', 'R03'],
  'general.jaimini': ['code:jaimini', 'R04'],
  'general.strength_yoga': ['code:strength_yoga', 'code:avastha', 'R05', 'R06'],
  'general.person': ['code:person', 'R13'],
  'general.reader': ALL_ORACLE_READER_SUBAGENTS,
  'general.oracle': ['oracle', 'addendum', 'synthesize'],
  'general.validator': ['validator'],
  'general.intake': ['intake'],
  'general.clarify': ['clarify'],
  'self.reading.oracle': [
    'family.rasi',
    'family.varga',
    'family.dasha',
    'family.year',
    'family.sky',
    'lineman.self',
    'oracle.self',
  ],
  'love.reading.oracle': [
    'family.rasi',
    'family.varga',
    'family.dasha',
    'family.year',
    'family.sky',
    'lineman.love',
    'oracle.love',
  ],
  'work.reading.oracle': [
    'family.rasi',
    'family.varga',
    'family.dasha',
    'family.year',
    'family.sky',
    'lineman.work',
    'oracle.work',
  ],
};

/** Maps a technique ID to its `SubAgentId[]` in `SUBAGENT_DIGEST_SPECS`. */
export function subAgentsForTechnique(techniqueId: string): SubAgentId[] {
  return [...(TECHNIQUE_TO_SUBAGENTS[techniqueId] ?? [])];
}

function uniqueDigestSections(
  readers: ReaderUse[],
  specs: SubAgentDigestSpec[],
): Array<'house' | 'planet' | 'yoga' | 'point' | 'annual' | 'star' | 'activation'> {
  const set = new Set<'house' | 'planet' | 'yoga' | 'point' | 'annual' | 'star' | 'activation'>();
  for (const r of readers) {
    if (
      r.section === 'house' ||
      r.section === 'planet' ||
      r.section === 'yoga' ||
      r.section === 'point' ||
      r.section === 'annual' ||
      r.section === 'star' ||
      r.section === 'activation'
    ) {
      set.add(r.section);
    }
  }
  for (const s of specs) {
    for (const sec of s.sections) set.add(sec);
    if (s.usesActivation) set.add('activation');
  }
  return [...set];
}

/**
 * Builds the complete sub-agent & cache plan for a single technique definition.
 */
export function buildTechniqueSubAgentCachePlan(t: TechniqueDef): TechniqueSubAgentCachePlan {
  const recipe = recipeOf(t);
  const subAgents = subAgentsForTechnique(t.id);
  const subAgentSpecs = subAgents
    .map((id) => SUBAGENT_DIGEST_SPECS[id])
    .filter((s): s is SubAgentDigestSpec => Boolean(s));
  const readerPieces = recipe.readers.map((r) => r.piece);
  const digestSections = uniqueDigestSections(recipe.readers, subAgentSpecs);
  const userFields = [...t.contract.user];

  // 1. Specialist LLM analysts (`general.promise`, `general.dasha`, `general.transit`, `general.nakshatra`, `general.annual`, `general.prashna`)
  if (
    t.id === 'general.promise' ||
    t.id === 'general.dasha' ||
    t.id === 'general.transit' ||
    t.id === 'general.nakshatra' ||
    t.id === 'general.annual' ||
    t.id === 'general.prashna'
  ) {
    const isNatal = t.id === 'general.promise' || t.id === 'general.nakshatra';
    return {
      techniqueId: t.id,
      title: t.title,
      board: t.board,
      category: t.category,
      status: t.status,
      recipe,
      subAgents,
      subAgentSpecs,
      llmCacheUpload: {
        usesLlmCache: true,
        cacheStore: 'gemini_cached_contents+llm_cache_entries',
        cacheKeyFormula: 'sha256(model | system(specialistPrompt + FullContext.system) | cachedPrefix(FullContext.prefix from kundli_digest))',
        systemPromptPiece: recipe.prompt,
        cachedPrefixReaderPieces: readerPieces,
        digestSections,
        perRequestSuffixFields: userFields,
        ttlSeconds: 3600,
      },
      outputCache: {
        primaryTable: 'reading_findings_cache',
        cacheKeyFormula: isNatal
          ? 'findingsKey({ kundliId, analyst, subject, packHash, horizonKey: "natal", promptVer })'
          : 'findingsKey({ kundliId, analyst, subject, packHash, horizonKey: "<horizon>:<YYYY-MM-DD>", promptVer })',
        freshness: recipe.freshness,
        scope: recipe.scope,
        outputPiece: recipe.output,
        recycledEvery45m: true,
      },
      processes: {
        preRunDataPreparation: [
          'kundli-digest worker (`POST /events` -> `handleDigestEvent` -> `buildDigest` writes `kundli_digest` + `kundli_activation`)',
          '15m `kundli-digest-sweep` (`sweepDigests` + `ensureAnnualSet` top-up)',
        ],
        preRunCacheUploadAndWarm: [
          'Clarify turn (`POST /api/chat/clarify` & `POST /api/chat/prewarm` -> `prewarmNatalLayers` loads `DigestView`, builds `FullContext` with digest overlay, calls `ensurePromptCache` to upload Gemini `cachedContents` + `llm_cache_entries`, and pre-runs natal specialists into `reading_findings_cache`)',
        ],
        liveRequestExecution: [
          'Graph / single reading flow (`runReading` -> `buildReadingGraph` -> `runSpecialist` checks `findingsCache` + `loadDbSpecialistFinding` in `reading_findings_cache`; on miss calls `llmCallWithPrefix` using the pre-uploaded `llm_cache_entries.provider_name` handle and saves to `reading_findings_cache`)',
        ],
        invalidationAndRecycleSweep: [
          '45m per-individual inactivity recycler (`recycleIndividualCaches` in `src/reading/llm/cacheSweep.ts` deletes remote Gemini `cachedContents` and evicts `llm_cache_entries` + `reading_findings_cache` for kundlis idle >= 45m)',
          'Daily/scheduled `runScheduledSweep` (`sweepExpiredCaches` deletes expired `llm_cache_entries` and `reading_findings_cache`)',
        ],
      },
    };
  }

  // 2. Oracle reader curriculum (`general.reader` -> R01..R14, P1..P3)
  if (t.id === 'general.reader') {
    return {
      techniqueId: t.id,
      title: t.title,
      board: t.board,
      category: t.category,
      status: t.status,
      recipe,
      subAgents,
      subAgentSpecs,
      llmCacheUpload: {
        usesLlmCache: true,
        cacheStore: 'gemini_cached_contents+llm_cache_entries',
        cacheKeyFormula: 'sha256(model | system(readerCurriculumPrompt) | cachedPrefix(CHART CORE + reader digest slice))',
        systemPromptPiece: recipe.prompt,
        cachedPrefixReaderPieces: readerPieces,
        digestSections,
        perRequestSuffixFields: userFields,
        ttlSeconds: 3600,
      },
      outputCache: {
        primaryTable: 'reading_findings_cache',
        cacheKeyFormula: 'readerFindingsKey({ kundliId, readerId, scopeKey: "natal" | "<subject>:<horizon>:<asOf>" | "person:<who>:<asOf>", sliceHash, promptVer })',
        freshness: recipe.freshness,
        scope: recipe.scope,
        outputPiece: recipe.output,
        recycledEvery45m: true,
      },
      processes: {
        preRunDataPreparation: [
          'kundli-digest worker (`POST /events` -> `handleDigestEvent` -> `buildDigest` writes `kundli_digest` + `kundli_activation` from stored chart rows once)',
          '15m `kundli-digest-sweep` (`sweepDigests` + `ensureAnnualSet`)',
        ],
        preRunCacheUploadAndWarm: [
          'Clarify turn (`POST /api/chat/clarify` & `POST /api/chat/prewarm` -> `prewarmOracleReaders` -> `prepareChartBundle` slices `kundli_digest` + `kundli_activation` via `buildTablesFromDigest` with zero `kundli_data` queries on natal hits, runs R01..R06 + R13 in background, and persists findings to `reading_findings_cache` via `saveDbReaderCache`)',
        ],
        liveRequestExecution: [
          'Oracle flow (`runOracleFlow` -> `prepareChartBundle` -> `runReader` checks `getReaderMemo` (L1) + `loadDbReaderCache` (`reading_findings_cache` L2); on miss invokes model with sliced `CHART CORE + TABLE SLICE` from `kundli_digest` and stores in `reading_findings_cache`)',
        ],
        invalidationAndRecycleSweep: [
          '45m per-individual inactivity recycler (`recycleIndividualCaches` evicts `reading_findings_cache` and `llm_cache_entries` for kundlis idle >= 45m)',
          'Scheduled `runScheduledSweep` (`sweepExpiredCaches`)',
        ],
      },
    };
  }

  // 3. Deterministic General Reading code readers (`general.varga_dynamics`, `general.jaimini`, `general.strength_yoga`, `general.person`)
  if (
    t.id === 'general.varga_dynamics' ||
    t.id === 'general.jaimini' ||
    t.id === 'general.strength_yoga' ||
    t.id === 'general.person'
  ) {
    return {
      techniqueId: t.id,
      title: t.title,
      board: t.board,
      category: t.category,
      status: t.status,
      recipe,
      subAgents,
      subAgentSpecs,
      llmCacheUpload: {
        usesLlmCache: false,
        cacheStore: 'none_deterministic_code',
        cacheKeyFormula: 'none (deterministic code reader over kundli_digest; optional paired R03/R04/R05/R06/R13 model reader uses reading_findings_cache)',
        systemPromptPiece: null,
        cachedPrefixReaderPieces: readerPieces,
        digestSections,
        perRequestSuffixFields: [],
        ttlSeconds: 0,
      },
      outputCache: {
        primaryTable: 'reading_findings_cache+technique_outputs',
        cacheKeyFormula: 'techniqueCacheKey(v1|<id>|<contractHash>|<kundliId>|d:<digestVersion>|natal|-|-) in technique_outputs',
        freshness: recipe.freshness,
        scope: recipe.scope,
        outputPiece: recipe.output,
        recycledEvery45m: true,
      },
      processes: {
        preRunDataPreparation: [
          'kundli-digest worker (`POST /events` -> `buildDigest` populates `kundli_digest` house, planet, point, and yoga sections)',
        ],
        preRunCacheUploadAndWarm: [
          'First reading or Clarify prewarm (`runCodeReadersCached` in `src/reading/codeReaders/readers.ts` wraps each code reader in `withTechniqueOutput` and writes `findings.v2` into `technique_outputs`)',
        ],
        liveRequestExecution: [
          'Oracle & Graph flows (`runOracleFlow` / `buildReadingGraph` -> `runCodeReadersCached` reads digested `AnalystFindings` directly from `technique_outputs` on cache hit and records `agent_runs.status = "cached"`, skipping code execution)',
        ],
        invalidationAndRecycleSweep: [
          'Digest rebuild invalidation (`buildDigest` -> `deleteKundliTechniqueOutputs(prisma, kundliId)`)',
          '45m per-individual inactivity recycler (`recycleIndividualCaches` deletes `technique_outputs` for kundlis idle >= 45m)',
        ],
      },
    };
  }

  // 4. Oracle & Synthesizer (`general.oracle`)
  if (t.id === 'general.oracle') {
    return {
      techniqueId: t.id,
      title: t.title,
      board: t.board,
      category: t.category,
      status: t.status,
      recipe,
      subAgents,
      subAgentSpecs,
      llmCacheUpload: {
        usesLlmCache: true,
        cacheStore: 'gemini_cached_contents+llm_cache_entries',
        cacheKeyFormula: 'sha256(model | system(oracleOrSynthSystemPrompt + FullContext.system) | cachedPrefix(FullContext.prefix or cited DigestView rows + reader findings brief))',
        systemPromptPiece: recipe.prompt,
        cachedPrefixReaderPieces: readerPieces,
        digestSections,
        perRequestSuffixFields: userFields,
        ttlSeconds: 3600,
      },
      outputCache: {
        primaryTable: 'request_ephemeral',
        cacheKeyFormula: 'question-scoped streaming response (persisted to chat thread message history)',
        freshness: recipe.freshness,
        scope: recipe.scope,
        outputPiece: recipe.output,
        recycledEvery45m: true,
      },
      processes: {
        preRunDataPreparation: [
          'kundli-digest worker (`buildDigest` prepares `kundli_digest` rows cited by reader/analyst findings)',
        ],
        preRunCacheUploadAndWarm: [
          'Clarify turn (`prewarmOracleReaders` / `prewarmNatalLayers` warms the `FullContext` prefix in `llm_cache_entries` and pre-populates `reading_findings_cache` + `technique_outputs` so the Oracle brief assembles immediately)',
        ],
        liveRequestExecution: [
          'Oracle / Graph synthesis (`runOracleFlow` / `synthesize` joins cached findings from `reading_findings_cache` + `technique_outputs` + cited `DigestView` rows and streams the final answer)',
        ],
        invalidationAndRecycleSweep: [
          '45m per-individual inactivity recycler (`recycleIndividualCaches` cleans up `llm_cache_entries` for the kundli)',
        ],
      },
    };
  }

  // 4b. Board Reading AI Sub-Agents -> Lineman -> Oracle (`self.reading.oracle`, `love.reading.oracle`, `work.reading.oracle`)
  if (t.id === 'self.reading.oracle' || t.id === 'love.reading.oracle' || t.id === 'work.reading.oracle') {
    const bName = t.id.split('.')[0] ?? 'self';
    return {
      techniqueId: t.id,
      title: t.title,
      board: t.board,
      category: t.category,
      status: t.status,
      recipe,
      subAgents,
      subAgentSpecs,
      llmCacheUpload: {
        usesLlmCache: true,
        cacheStore: 'gemini_cached_contents+llm_cache_entries',
        cacheKeyFormula: 'sha256(model | system(familyOrLinemanOrOraclePrompt) | cachedPrefix(FAMILY PACK or LINEMAN BRIEF from kundli_digest + kundli_activation))',
        systemPromptPiece: recipe.prompt,
        cachedPrefixReaderPieces: readerPieces,
        digestSections,
        perRequestSuffixFields: userFields,
        ttlSeconds: 3600,
      },
      outputCache: {
        primaryTable: 'reading_findings_cache+technique_outputs',
        cacheKeyFormula: `reading_findings_cache(family.<layer>|lineman.${bName}) + techniqueCacheKey(${t.id})`,
        freshness: recipe.freshness,
        scope: recipe.scope,
        outputPiece: recipe.output,
        recycledEvery45m: true,
      },
      processes: {
        preRunDataPreparation: [
          'kundli-digest worker (`POST /events` -> `buildDigest` writes `kundli_digest` + `kundli_activation`)',
          '15m `kundli-digest-sweep` (`sweepDigests` + `ensureAnnualSet` top-up)',
        ],
        preRunCacheUploadAndWarm: [
          `Board reading build (\`runSelfOracle\` slices \`DigestView\` + \`ActivationRow[]\` + \`TransitRangePayload\` into 5 shared family packs, uploads each pack prefix via \`ensurePromptCache\` / \`cachePrefix: true\` into \`llm_cache_entries\`, and persists \`family.rasi\`, \`family.varga\`, \`family.dasha\`, \`family.year\`, \`family.sky\`, and \`lineman.${bName}\` findings in \`reading_findings_cache\`)`,
        ],
        liveRequestExecution: [
          `Board reading service (\`getBoardReading\` -> \`runSelfOracle\` reads shared cached family findings from \`reading_findings_cache\` and cached Oracle output from \`technique_outputs\`, or runs the 5 family sub-agents -> \`lineman.${bName}\` -> \`${bName}.reading_oracle\` under the $1.00 spend guard)`,
        ],
        invalidationAndRecycleSweep: [
          '45m per-individual inactivity recycler (`recycleIndividualCaches` preserves unexpired natal `family.*` rows and `llm` `technique_outputs` while evicting expired windows and Gemini `cachedContents`)',
        ],
      },
    };
  }

  // 5. Question-scoped chat control-plane LLM techniques (`general.intake`, `general.clarify`, `general.validator`)
  if (t.id === 'general.intake' || t.id === 'general.clarify' || t.id === 'general.validator') {
    return {
      techniqueId: t.id,
      title: t.title,
      board: t.board,
      category: t.category,
      status: t.status,
      recipe,
      subAgents,
      subAgentSpecs,
      llmCacheUpload: {
        usesLlmCache: false,
        cacheStore: 'system_prompt_only',
        cacheKeyFormula: 'none (lightweight question-only turn; reads companion memory / person_facts and triggers background prewarm)',
        systemPromptPiece: recipe.prompt,
        cachedPrefixReaderPieces: readerPieces,
        digestSections: [],
        perRequestSuffixFields: userFields,
        ttlSeconds: 0,
      },
      outputCache: {
        primaryTable: 'request_ephemeral',
        cacheKeyFormula: 'question-scoped turn state (triggers `prewarmOracleReaders` / `prewarmNatalLayers` on `general.clarify`)',
        freshness: recipe.freshness,
        scope: recipe.scope,
        outputPiece: recipe.output,
        recycledEvery45m: false,
      },
      processes: {
        preRunDataPreparation: [
          'Reads `person_facts` companion memory (zero `kundli_data` chart queries)',
        ],
        preRunCacheUploadAndWarm: [
          t.id === 'general.clarify'
            ? 'Clarify turn (`POST /api/chat/clarify` & `POST /api/chat/prewarm`) launches `prewarmOracleReaders` (Oracle flow) and `prewarmNatalLayers` (Graph/Single flow) in the background while the user answers the clarify chip'
            : 'Triggered inline during the chat turn',
        ],
        liveRequestExecution: [
          `Executes ${t.agents.join(', ')} with a tight budget (${t.id === 'general.clarify' ? '900 ms' : t.id === 'general.validator' ? '2000 ms' : '1500 ms'}) over the question text only`,
        ],
        invalidationAndRecycleSweep: [
          'Ephemeral turn state; no per-kundli chart cache row written directly',
        ],
      },
    };
  }

  // 6. Digest foundation techniques (`digest.build`, `digest.annual_set`, `digest.activation`)
  if (t.id.startsWith('digest.')) {
    return {
      techniqueId: t.id,
      title: t.title,
      board: t.board,
      category: t.category,
      status: t.status,
      recipe,
      subAgents,
      subAgentSpecs,
      llmCacheUpload: {
        usesLlmCache: false,
        cacheStore: 'none_deterministic_code',
        cacheKeyFormula: 'none (producer of `kundli_digest` and `kundli_activation` consumed by all sub-agent cache uploads)',
        systemPromptPiece: null,
        cachedPrefixReaderPieces: readerPieces,
        digestSections,
        perRequestSuffixFields: [],
        ttlSeconds: 0,
      },
      outputCache: {
        primaryTable: 'kundli_digest+kundli_activation',
        cacheKeyFormula: 'kundli_digest(kundli_id, section, key) + kundli_activation(kundli_id, system, level, start_at, end_at) stamped with digest_version',
        freshness: recipe.freshness,
        scope: recipe.scope,
        outputPiece: recipe.output,
        recycledEvery45m: false,
      },
      processes: {
        preRunDataPreparation: [
          'Triggered on kundli registration / chart update via `POST /events` (`name: "kundli-digest"`) -> `handleDigestEvent`',
          'Picked up every 15 minutes by `kundli-digest-sweep` (`sweepDigests` + `ensureAnnualSet` top-up)',
        ],
        preRunCacheUploadAndWarm: [
          'Writes the 6 `kundli_digest` sections (`house`, `planet`, `yoga`, `point`, `annual`, `star`) and 30-year `kundli_activation` calendar in one transaction so downstream sub-agents never read raw `kundli_data`',
        ],
        liveRequestExecution: [
          'Loaded in ~5–15 ms via `loadDigest(prisma, kundliId)` and `activationFor(prisma, kundliId, filter)`',
        ],
        invalidationAndRecycleSweep: [
          'On rebuild, `buildDigest` calls `deleteKundliTechniqueOutputs(prisma, kundliId)` and invalidates `area_builds` so downstream caches refresh cleanly',
        ],
      },
    };
  }

  // 7. Lucky Times techniques (`lucky.day_tables`, `lucky.personal_overlay`, `lucky.avoid_bands`, `lucky.panchang_limbs`, and 13 `lucky.<scenario>`)
  if (t.id.startsWith('lucky.')) {
    const isSharedSky = t.id === 'lucky.day_tables' || t.id === 'lucky.avoid_bands' || t.id === 'lucky.panchang_limbs';
    return {
      techniqueId: t.id,
      title: t.title,
      board: t.board,
      category: t.category,
      status: t.status,
      recipe,
      subAgents,
      subAgentSpecs,
      llmCacheUpload: {
        usesLlmCache: false,
        cacheStore: 'none_deterministic_code',
        cacheKeyFormula: 'none (deterministic muhurta & panchang window scoring over `day_tables`, `kundli_day_overlays`, and `kundli_digest`)',
        systemPromptPiece: null,
        cachedPrefixReaderPieces: readerPieces,
        digestSections,
        perRequestSuffixFields: [],
        ttlSeconds: 0,
      },
      outputCache: {
        primaryTable: 'day_tables+kundli_day_overlays',
        cacheKeyFormula: isSharedSky
          ? 'day_tables(place_key, date_local) + techniqueCacheKey(daily [00:00Z, 24:00Z))'
          : 'kundli_day_overlays(kundli_id, place_key, date_local) + techniqueCacheKey(daily [00:00Z, 24:00Z))',
        freshness: recipe.freshness,
        scope: recipe.scope,
        outputPiece: recipe.output,
        recycledEvery45m: !isSharedSky,
      },
      processes: {
        preRunDataPreparation: [
          'Universal 28-day sky prepull (`prepullUniversalDayTables` across the 5 reference timezone places `us-east`, `us-central`, `us-mountain`, `us-west`, `in-ist` into `day_tables`)',
          'kundli-digest worker (`buildDigest` provides D1 functional nature of hora lords and `kundli_activation` running dasha lords)',
        ],
        preRunCacheUploadAndWarm: [
          'Monthly personal overlay pull (`personalDays` writes `kundli_day_overlays` once per month & place)',
        ],
        liveRequestExecution: [
          'Lucky Times service (`getRange` / `scenarioDay` scores candidate windows deterministically from `day_tables` + `kundli_day_overlays` + `DigestView`)',
        ],
        invalidationAndRecycleSweep: [
          '45m per-individual inactivity recycler (`recycleIndividualCaches` deletes `kundli_day_overlays` for kundlis idle >= 45m while keeping shared `day_tables`)',
        ],
      },
    };
  }

  // 8. Self, Love, Work, Life, and Research deterministic board/timeline techniques
  return {
    techniqueId: t.id,
    title: t.title,
    board: t.board,
    category: t.category,
    status: t.status,
    recipe,
    subAgents,
    subAgentSpecs,
    llmCacheUpload: {
      usesLlmCache: false,
      cacheStore: 'none_deterministic_code',
      cacheKeyFormula: 'none (deterministic board/timeline computation over `kundli_digest` + `kundli_activation`; digested output cached in `technique_outputs`)',
      systemPromptPiece: null,
      cachedPrefixReaderPieces: readerPieces,
      digestSections,
      perRequestSuffixFields: [],
      ttlSeconds: 0,
    },
    outputCache: {
      primaryTable: t.id.startsWith('life.') ? 'area_builds+technique_outputs' : 'technique_outputs',
      cacheKeyFormula: 'techniqueCacheKey(v1|<id>|<contractHash>|<kundliId>|d:<digestVersion>|<freshness>|<validFrom>|<validTo>)',
      freshness: recipe.freshness,
      scope: recipe.scope,
      outputPiece: recipe.output,
      recycledEvery45m: true,
    },
    processes: {
      preRunDataPreparation: [
        'kundli-digest worker (`POST /events` -> `buildDigest` writes `kundli_digest` + `kundli_activation`)',
        '15m `kundli-digest-sweep` (`sweepDigests` + `ensureAnnualSet` top-up)',
      ],
      preRunCacheUploadAndWarm: [
        'Read-through date-range cache (`withTechniqueOutput` in `src/techniques/outputStore.ts` computes once per validity window — 2h transit bucket, UTC day, running dasha span, solar/lunar return year, or natal — and stores the digested output in `technique_outputs`)',
      ],
      liveRequestExecution: [
        'Board & Timeline services (`getAreaBoard`, `getCareer`, `getLifeReading`) check `withTechniqueOutput` (`technique_outputs` covering `valid_from <= now < valid_to`); on hit return stored output immediately and log `agent_runs.status = "cached"`, skipping agent execution and DB table pulls',
      ],
      invalidationAndRecycleSweep: [
        'Digest rebuild invalidation (`buildDigest` -> `deleteKundliTechniqueOutputs(prisma, kundliId)`)',
        '45m per-individual inactivity recycler (`recycleIndividualCaches` deletes `technique_outputs` for kundlis idle >= 45m)',
        'Daily expiry sweep (`sweepTechniqueOutputs` in `src/reading/llm/cacheSweep.ts` deletes rows where `valid_to < now`)',
      ],
    },
  };
}

const PLAN_BY_ID = new Map<string, TechniqueSubAgentCachePlan>(
  TECHNIQUES.map((t) => [t.id, buildTechniqueSubAgentCachePlan(t)]),
);

/** Returns the sub-agent & cache upload plan for a technique ID. */
export function techniqueSubAgentCachePlan(techniqueId: string): TechniqueSubAgentCachePlan | undefined {
  const cached = PLAN_BY_ID.get(techniqueId);
  if (cached) return cached;
  const def = techniqueById(techniqueId);
  return def ? buildTechniqueSubAgentCachePlan(def) : undefined;
}

/** Returns plans for all registered techniques in `TECHNIQUES`. */
export function allTechniqueSubAgentCachePlans(): TechniqueSubAgentCachePlan[] {
  return TECHNIQUES.map((t) => PLAN_BY_ID.get(t.id) ?? buildTechniqueSubAgentCachePlan(t));
}

export interface TechniquePreRunSubAgentSlice {
  subAgentId: SubAgentId;
  spec: SubAgentDigestSpec;
  /** Materialized `ChartData` tables sliced exclusively from `DigestView` + `ActivationRow[]` (zero DB queries). */
  tables: Record<string, unknown>;
  /** Compact `CHART CORE` text rendered from the digest-sliced tables. */
  coreText: string;
  /** Any chart table types not covered by the digest (e.g. live transit/prashna if not passed in). */
  missing: string[];
}

export interface TechniquePreRunCacheBundle {
  plan: TechniqueSubAgentCachePlan;
  window: ValidityWindow;
  techniqueOutputCacheKey: string;
  subAgentSlices: TechniquePreRunSubAgentSlice[];
}

/**
 * Materializes the exact pre-run cache bundle for a technique from an already-loaded `DigestView`
 * and `ActivationRow[]` with **zero live `kundli_data` database queries**.
 *
 * Sub-agent runners and prewarm workers can call this helper to inspect or upload the exact
 * per-sub-agent `tables` and `coreText` slices required by the technique's agents.
 */
export function buildTechniquePreRunCacheBundle(args: {
  techniqueId: string;
  digest: DigestView;
  activation?: ActivationRow[];
  context: ValidityContext;
  person?: PersonFrame | null;
  prashna?: unknown;
  transitRows?: unknown;
}): TechniquePreRunCacheBundle {
  const def = techniqueById(args.techniqueId);
  if (!def) {
    throw new Error(`Unknown techniqueId: ${args.techniqueId}`);
  }
  const plan = techniqueSubAgentCachePlan(args.techniqueId)!;
  const window = validityWindow(def, args.context);
  const techniqueOutputCacheKey =
    techniqueCacheKey({
      technique: def,
      kundliId: String(args.digest.kundliId ?? 'kundli'),
      digestVersion: String(args.digest.version ?? '1'),
      window,
    }) ?? '';
  const asOfIso = (args.context.now ?? new Date()).toISOString().slice(0, 10);
  const activation = args.activation ?? [];

  const subAgentSlices: TechniquePreRunSubAgentSlice[] = plan.subAgentSpecs.map((spec) => {
    const built = sliceDigestForSubAgent(spec.id, args.digest, {
      asOf: asOfIso,
      activation,
      person: args.person ?? null,
      prashna: args.prashna,
      transitRows: args.transitRows,
    });
    const coreText = renderCore(built.tables, CORE_TYPES).text;
    return {
      subAgentId: spec.id,
      spec,
      tables: built.tables,
      coreText,
      missing: built.missing,
    };
  });

  return {
    plan,
    window,
    techniqueOutputCacheKey,
    subAgentSlices,
  };
}

/**
 * Summary statistics across all registered techniques for documentation and admin inspection.
 */
export function summarizeTechniqueSubAgentCachePlans() {
  const plans = allTechniqueSubAgentCachePlans();
  return {
    totalTechniques: plans.length,
    llmCachedTechniques: plans.filter((p) => p.llmCacheUpload.usesLlmCache).map((p) => p.techniqueId),
    systemPromptOnlyTechniques: plans
      .filter((p) => p.llmCacheUpload.cacheStore === 'system_prompt_only')
      .map((p) => p.techniqueId),
    deterministicCodeTechniques: plans
      .filter((p) => p.llmCacheUpload.cacheStore === 'none_deterministic_code')
      .map((p) => p.techniqueId),
    recycledEvery45mCount: plans.filter((p) => p.outputCache.recycledEvery45m).length,
    subAgentSpecCount: Object.keys(SUBAGENT_DIGEST_SPECS).length,
  };
}
