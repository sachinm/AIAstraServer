/**
 * Rolling latency percentiles and operation counters for Upstash Redis.
 *
 * Used by Milestone 4.5 (`src/telemetry/pageTiming.ts`) to enrich `page_execution_logs.meta.redis_latency_ms`
 * without storing any raw keys, tokens, or PII.
 */

export type RedisCircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type RedisOpKind = 'hit' | 'miss' | 'write' | 'error' | 'timeout';

export interface RedisTelemetrySnapshot {
  p50: number;
  p95: number;
  p99: number;
  sampleCount: number;
  hits: number;
  misses: number;
  writes: number;
  errors: number;
  timeouts: number;
  circuitOpens: number;
  circuitShortCircuits: number;
  circuitState: RedisCircuitState;
}

const MAX_LATENCY_SAMPLES = 512;
let latencySamples: number[] = [];
let hits = 0;
let misses = 0;
let writes = 0;
let errors = 0;
let timeouts = 0;
let circuitOpens = 0;
let circuitShortCircuits = 0;
let circuitState: RedisCircuitState = 'CLOSED';

export function recordRedisSample(params: { kind: RedisOpKind; latencyMs: number }): void {
  const safeLatency = Number.isFinite(params.latencyMs) && params.latencyMs >= 0 ? Math.round(params.latencyMs * 100) / 100 : 0;
  latencySamples.push(safeLatency);
  if (latencySamples.length > MAX_LATENCY_SAMPLES) {
    latencySamples.shift();
  }

  switch (params.kind) {
    case 'hit':
      hits += 1;
      break;
    case 'miss':
      misses += 1;
      break;
    case 'write':
      writes += 1;
      break;
    case 'timeout':
      timeouts += 1;
      errors += 1;
      break;
    case 'error':
      errors += 1;
      break;
  }
}

export function setRedisTelemetryCircuitState(nextState: RedisCircuitState, openedTransition = false): void {
  circuitState = nextState;
  if (openedTransition && nextState === 'OPEN') {
    circuitOpens += 1;
  }
}

export function recordRedisShortCircuit(): void {
  circuitShortCircuits += 1;
}

function computePercentile(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) return 0;
  const idx = Math.min(sortedAscending.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAscending.length) - 1));
  return sortedAscending[idx] ?? 0;
}

export function getRedisTelemetrySnapshot(): RedisTelemetrySnapshot {
  const sorted = [...latencySamples].sort((a, b) => a - b);
  return {
    p50: computePercentile(sorted, 50),
    p95: computePercentile(sorted, 95),
    p99: computePercentile(sorted, 99),
    sampleCount: sorted.length,
    hits,
    misses,
    writes,
    errors,
    timeouts,
    circuitOpens,
    circuitShortCircuits,
    circuitState,
  };
}

export function resetRedisTelemetryForTests(): void {
  latencySamples = [];
  hits = 0;
  misses = 0;
  writes = 0;
  errors = 0;
  timeouts = 0;
  circuitOpens = 0;
  circuitShortCircuits = 0;
  circuitState = 'CLOSED';
}
