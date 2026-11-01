/**
 * Per-query money ledger for the oracle flow (docs/reading-engine/39 §6). No model call is made without a reservation.
 *
 *   reserve → the worst case (prompt at full input price + maxOutputTokens at output price; Gemini counts thinking inside
 *             maxOutputTokens, so this is a hard bound) must fit the stage's cap and the query cap;
 *             if it does not fit, maxOutputTokens is lowered; below MIN_OUTPUT_TOKENS the call is refused.
 *   settle  → actual usage replaces the reservation, so unused money returns at once. Parallel readers cannot overspend
 *             together because open reservations count against the caps.
 *
 * An unknown model is refused rather than priced at 0. Money for the Oracle is held back from the query cap until the
 * Oracle has reserved, so readers can never leave a question with no answer.
 */
import { readingCostCaps } from '../config.js';
import { priceFor } from '../llm/models.js';
import type { Usage } from '../types.js';

export type CostStage = 'fanout' | 'oracle' | 'support';

/** Below this the output would be too short to be useful: the call is refused instead. */
export const MIN_OUTPUT_TOKENS = 300;

export class CostRefusedError extends Error {
  constructor(
    message: string,
    readonly reason: 'unknown_model' | 'budget'
  ) {
    super(message);
    this.name = 'CostRefusedError';
  }
}

export interface Reservation {
  id: number;
  stage: CostStage;
  node: string;
  model: string;
  /** the output limit the call must send: possibly lower than asked */
  maxOutputTokens: number;
  usd: number;
}

export interface CostLine {
  node: string;
  stage: CostStage;
  model: string;
  usd: number;
  estimate?: boolean;
}

const round = (n: number): number => Math.round(n * 1_000_000) / 1_000_000;

export class CostGuard {
  readonly caps;
  /** On this date's prices (repricings take effect by date). */
  readonly on: string;
  /** Money set aside for the Oracle until it has reserved. */
  private oracleHold: number;
  private open = new Map<number, Reservation>();
  private lines: CostLine[] = [];
  private seq = 0;
  private refused = 0;

  constructor(opts: { on?: string; caps?: { fanout: number; oracle: number; query: number }; oracleHoldUsd?: number } = {}) {
    this.caps = opts.caps ?? readingCostCaps();
    this.on = opts.on ?? new Date().toISOString().slice(0, 10);
    this.oracleHold = Math.min(opts.oracleHoldUsd ?? 0.03, this.caps.oracle, this.caps.query);
  }

  /** Money billed so far, in total or for one stage. */
  spent(stage?: CostStage): number {
    return round(this.lines.filter((l) => !stage || l.stage === stage).reduce((n, l) => n + l.usd, 0));
  }

  private openUsd(stage?: CostStage): number {
    let n = 0;
    for (const r of this.open.values()) if (!stage || r.stage === stage) n += r.usd;
    return n;
  }

  /** What this stage may still commit: its cap minus what is spent and reserved, and never beyond the query cap. */
  remaining(stage: CostStage): number {
    const hold = stage === 'oracle' ? 0 : this.oracleHold;
    const query = this.caps.query - this.spent() - this.openUsd() - hold;
    const own = stage === 'support' ? Infinity : (stage === 'fanout' ? this.caps.fanout : this.caps.oracle) - this.spent(stage) - this.openUsd(stage);
    return Math.max(0, Math.min(query, own));
  }

  /** Worst case in USD, or null for a model with no price. */
  worstCase(model: string, promptTokens: number, maxOutputTokens: number): number | null {
    const p = priceFor(model, this.on);
    if (!p) return null;
    return (promptTokens * p.in + maxOutputTokens * p.out) / 1_000_000;
  }

  /** Throws CostRefusedError when the call cannot be paid for. Returns the output limit to use. */
  reserve(a: { stage: CostStage; node: string; model: string; promptTokens: number; maxOutputTokens: number; minOutputTokens?: number }): Reservation {
    const p = priceFor(a.model, this.on);
    if (!p) {
      this.refused += 1;
      throw new CostRefusedError(`no price for model ${a.model}`, 'unknown_model');
    }
    const min = a.minOutputTokens ?? MIN_OUTPUT_TOKENS;
    const room = this.remaining(a.stage);
    const inputUsd = (a.promptTokens * p.in) / 1_000_000;
    const affordable = Math.floor(((room - inputUsd) * 1_000_000) / p.out);
    const maxOutputTokens = Math.min(a.maxOutputTokens, affordable);
    if (maxOutputTokens < min) {
      this.refused += 1;
      throw new CostRefusedError(`${a.node}: $${room.toFixed(4)} left cannot pay for ${a.promptTokens} tokens in and ${min} out`, 'budget');
    }
    const r: Reservation = { id: ++this.seq, stage: a.stage, node: a.node, model: a.model, maxOutputTokens, usd: inputUsd + (maxOutputTokens * p.out) / 1_000_000 };
    this.open.set(r.id, r);
    // the Oracle has its reservation: its hold is no longer needed
    if (a.stage === 'oracle') this.oracleHold = 0;
    return r;
  }

  /** Replaces a reservation with the actual bill. Pass the usage of a failed attempt too: it was billed. */
  settle(r: Reservation, usage: Pick<Usage, 'promptTokens' | 'cachedTokens' | 'outputTokens' | 'thoughtTokens'> | null): number {
    this.open.delete(r.id);
    if (!usage) return 0;
    const p = priceFor(r.model, this.on)!;
    const uncached = Math.max(0, usage.promptTokens - usage.cachedTokens);
    const usd = (uncached * p.in + usage.cachedTokens * p.cached + (usage.outputTokens + usage.thoughtTokens) * p.out) / 1_000_000;
    this.lines.push({ node: r.node, stage: r.stage, model: r.model, usd });
    return usd;
  }

  /** Money spent before this guard existed (prewarm during clarify) or not tied to one call (cache storage). */
  record(line: CostLine): void {
    this.lines.push(line);
  }

  summary(): { usd: number; fanout: number; oracle: number; support: number; refused: number; caps: { fanout: number; oracle: number; query: number }; lines: CostLine[] } {
    return { usd: this.spent(), fanout: this.spent('fanout'), oracle: this.spent('oracle'), support: this.spent('support'), refused: this.refused, caps: this.caps, lines: this.lines.map((l) => ({ ...l, usd: round(l.usd) })) };
  }
}
