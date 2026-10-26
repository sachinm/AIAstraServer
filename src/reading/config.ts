/** Environment switches for the reading engine. All optional. The reading engine is the chat path by default. */

export type ReadingFlow = 'single' | 'graph';

/** The reading engine answers chat by default (Sachin, 2026-10-24: "we must use the new chat path"). READING_ENGINE=0 is the kill switch. */
export function isReadingEngineEnabled(): boolean {
  return process.env.READING_ENGINE?.trim() !== '0';
}

/**
 * single: intake → evidence pack → ONE streamed call (Phase 1).
 * graph:  intake → pack → parallel specialists → reconcile → streamed synthesis (Phase 2 flow).
 */
export function readingFlow(): ReadingFlow {
  return process.env.READING_FLOW?.trim().toLowerCase() === 'graph' ? 'graph' : 'single';
}

/** db (default): kundli_facts + transit_snapshots filled from the pyjhora Lambda. fixture: golden chart G1, no DB or engine. */
export function readingFactsSource(): 'db' | 'fixture' {
  return process.env.READING_FACTS_SOURCE?.trim().toLowerCase() === 'fixture' ? 'fixture' : 'db';
}

/**
 * Emergency opt-in only (READING_FALLBACK_LEGACY=1): when a kundli has no dossier yet, answer on the legacy path.
 * Off by default: the reading engine then says the chart is being prepared and schedules the build.
 */
export function readingFallbackToLegacy(): boolean {
  return process.env.READING_FALLBACK_LEGACY?.trim() === '1';
}

/** Build a dossier after kundli sync / lazily on a miss. Default: on when the engine is enabled. */
export function readingBuildFactsEnabled(): boolean {
  const v = process.env.READING_FACTS_BUILD?.trim();
  if (v === '0') return false;
  if (v === '1') return true;
  return isReadingEngineEnabled();
}

export function readingCacheTtlMs(): number {
  const n = Number(process.env.READING_CACHE_TTL_MS);
  return Number.isFinite(n) && n >= 0 ? n : 5 * 60_000;
}

export function readingEngineTimeoutMs(): number {
  const n = Number(process.env.READING_ENGINE_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 8000;
}

/** Per-specialist timeout. 18 s (was 12 s): with a 4,096-token budget a full JSON answer can take longer than 12 s. */
export function readingSpecialistTimeoutMs(): number {
  const n = Number(process.env.READING_SPECIALIST_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 18_000;
}

/**
 * Extra time a specialist gets when its model thinks (Gemini 3.x: `thinking: 'off'` is sent as `thinkingLevel: low`, so the
 * model still thinks before it writes the JSON). Added on top of READING_SPECIALIST_TIMEOUT_MS. Default 12 s; 0 turns it off.
 */
export function readingSpecialistThinkingMs(): number {
  const n = Number(process.env.READING_SPECIALIST_THINKING_MS);
  return process.env.READING_SPECIALIST_THINKING_MS?.trim() && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 12_000;
}

/**
 * Extra output tokens a specialist gets when its model thinks: thought tokens are taken from maxOutputTokens, so without
 * this the JSON is cut off (finishReason MAX_TOKENS) once thinking has used part of the 4,096. Default 4,096; 0 turns it off.
 */
export function readingSpecialistThinkingTokens(): number {
  const n = Number(process.env.READING_SPECIALIST_THINKING_TOKENS);
  return process.env.READING_SPECIALIST_THINKING_TOKENS?.trim() && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 4096;
}

/** Output budget for the final answer. Thinking tokens share it, so it must leave room for a deep answer after thinking. */
export function readingSynthMaxTokens(): number {
  const n = Number(process.env.READING_SYNTH_MAX_OUTPUT_TOKENS);
  return Number.isFinite(n) && n >= 512 ? Math.floor(n) : 12_288;
}

/**
 * Output budget for each specialist's JSON findings. At 1,800 the cheap readers ran out mid-JSON (MAX_TOKENS) and the layer
 * was lost, so the default is 4,096.
 */
export function readingSpecialistMaxTokens(): number {
  const n = Number(process.env.READING_SPECIALIST_MAX_OUTPUT_TOKENS);
  return Number.isFinite(n) && n >= 512 ? Math.floor(n) : 4096;
}

/**
 * Thinking effort for the final answer: off|low|medium|high. Default medium: at low, Gemini 3.x often does no thinking at all
 * (0 thought tokens), which leaves nothing to stream to the Thinking panel and gives shallow answers.
 */
export function readingSynthThinking(): 'off' | 'low' | 'medium' | 'high' {
  const v = process.env.READING_SYNTH_THINKING?.trim().toLowerCase();
  return v === 'off' || v === 'low' || v === 'high' ? v : 'medium';
}

/**
 * Stream Gemini's thought summaries to the client while the answer is being prepared (event `thought`). On by default;
 * READING_INCLUDE_THOUGHTS=0 turns it off. Thought tokens are billed whether or not they are shown, so this adds no model cost.
 */
export function readingIncludeThoughts(): boolean {
  const v = process.env.READING_INCLUDE_THOUGHTS?.trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off');
}

/**
 * Put the rest of the stable chart data (every divisional chart the dossier holds, ashtavarga, the dasha tree, arudhas,
 * special lagnas, yogas, doshas) into the cacheable `base` block. Gemini 3.x only caches a prefix of at least 4,096 tokens,
 * and the bare base is about 3k. On by default; READING_FULL_BASE=0 returns to the small base.
 */
export function readingFullBase(): boolean {
  const v = process.env.READING_FULL_BASE?.trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off');
}

/**
 * Give the writer the dated calendar (src/reading/calendar): dasha boundaries, ingresses, stations, double-transit and
 * Sade Sati edges inside the horizon, read from the evidence pack. On by default; READING_CALENDAR=0 turns it off.
 */
export function readingCalendar(): boolean {
  const v = process.env.READING_CALENDAR?.trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off');
}

/** Use the DB `pvr_oracle` persona instead of the file persona. Off by default: a daily-changing system prompt breaks the prefix cache. */
export function readingUseDbPersona(): boolean {
  return process.env.READING_USE_DB_PERSONA?.trim() === '1';
}

export function readingFixtureDir(): string {
  return process.env.READING_FIXTURE_DIR?.trim() || 'evals/fixtures/G1';
}

/**
 * Findings contract version (docs 25). v2: rewritten specialist and writer prompts (prompts/v2), culprits, contributors,
 * form and per-window fruit in the findings, and the pack additions they read (star lords, dasha lord records, transit
 * legend). READING_FINDINGS=v2 turns it on; anything else keeps v1.
 */
export function readingFindingsV2(): boolean {
  return process.env.READING_FINDINGS?.trim().toLowerCase() === 'v2';
}
