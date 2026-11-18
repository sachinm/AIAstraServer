/**
 * One operation, one budget (Sachin, 2026-11-18; docs/billing/README.md "Spend cap per operation"). An operation is one
 * general reading response (ask-stream), one card-chat answer, one dashboard reading refresh (a build run) or one card
 * read the page asks for. Nothing is counted per day.
 *
 * This counter is for the paths with no reservation ledger (the reading's single and graph flows): each call's cost is
 * added as it returns (`usageCostUsd`, the price table of the day); before another call starts, `allows` says whether
 * the operation is still under its cap. A call that has started is never cut: an answer is never stopped mid-stream.
 * The oracle flow uses its own reservation ledger (`oracle/costGuard.ts`) under the same cap.
 */
import { getReadingSpendCapUsd } from '../../config/env.js';
import { CostRefusedError } from '../oracle/costGuard.js';
import type { Usage } from '../types.js';
import { usageCostUsd } from './models.js';

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

export class OperationBudget {
  private spent = 0;
  private logged = false;

  constructor(
    readonly op: string,
    readonly capUsd: number = getReadingSpendCapUsd(),
    private readonly on?: string,
    private readonly log: (line: Record<string, unknown>) => void = (line) => console.log(JSON.stringify(line)),
  ) {}

  /** USD spent by this operation so far. */
  spentUsd(): number {
    return this.spent;
  }

  /** Counts one call's bill (a failed attempt that reported usage was billed too). */
  add(usage: Pick<Usage, 'model' | 'promptTokens' | 'cachedTokens' | 'outputTokens' | 'thoughtTokens'> | null | undefined): void {
    if (usage) this.spent = round6(this.spent + usageCostUsd(usage, this.on));
  }

  /** True while another call may start. The first time it may not, one log line says so. */
  allows(node: string): boolean {
    if (this.spent < this.capUsd) return true;
    if (!this.logged) {
      this.logged = true;
      this.log({ msg: 'reading spend cap', op: this.op, node, spentUsd: this.spent, capUsd: this.capUsd });
    }
    return false;
  }

  /** Throws CostRefusedError('budget') when another call may not start (the caller's existing failure path). */
  require(node: string): void {
    if (!this.allows(node)) throw new CostRefusedError(`${node}: the operation spent $${this.spent.toFixed(4)} of its $${this.capUsd.toFixed(2)} cap`, 'budget');
  }
}
