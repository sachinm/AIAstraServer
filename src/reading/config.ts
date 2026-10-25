/** Environment switches for the reading engine. All optional; defaults keep today's chat path untouched. */

export type ReadingFlow = 'single' | 'graph';

/** READING_ENGINE=1 routes chat through the reading engine; 0 (default) keeps the legacy path (kill switch). */
export function isReadingEngineEnabled(): boolean {
  return process.env.READING_ENGINE?.trim() === '1';
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

/** When the dossier is not ready (engine does not serve it yet, build pending) fall back to the legacy path. Default on. */
export function readingFallbackToLegacy(): boolean {
  return process.env.READING_FALLBACK_LEGACY?.trim() !== '0';
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

export function readingSpecialistTimeoutMs(): number {
  const n = Number(process.env.READING_SPECIALIST_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 12_000;
}

export function readingSynthMaxTokens(): number {
  const n = Number(process.env.READING_SYNTH_MAX_OUTPUT_TOKENS);
  return Number.isFinite(n) && n >= 512 ? Math.floor(n) : 4096;
}

/** Thinking effort for the final answer: off|low|medium|high. Default low (Phase A latency lesson: 512-token budget ≈ 21 s). */
export function readingSynthThinking(): 'off' | 'low' | 'medium' | 'high' {
  const v = process.env.READING_SYNTH_THINKING?.trim().toLowerCase();
  return v === 'off' || v === 'medium' || v === 'high' ? v : 'low';
}

/** Use the DB `pvr_oracle` persona instead of the file persona. Off by default: a daily-changing system prompt breaks the prefix cache. */
export function readingUseDbPersona(): boolean {
  return process.env.READING_USE_DB_PERSONA?.trim() === '1';
}

export function readingFixtureDir(): string {
  return process.env.READING_FIXTURE_DIR?.trim() || 'evals/fixtures/G1';
}
