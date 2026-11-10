/**
 * S1 `self.sub.clock` (docs/reading-engine/66 §4.8): the primary dasha clock and the clocks that confirm it. Uses
 * `resolveClockV2`, the same resolver GET /api/self/v2 reads the board with (src/reading/self/v2api/service.ts
 * `clockFor`), so the build stores its cards under the clock the page asks for. With the v1 `resolveClock` here the
 * build kept a stored preference the page no longer allows (kaala on c584c0a3, 2026-11-10) while the page read
 * dwisatpathi: nothing ever matched and every card stayed pending. `applicability` is the engine's `dasha.applicable`
 * export (null when none is stored: the activation family is then the verdict).
 */
import { resolveClockV2, type ApplicabilityRow, type SystemPresence } from '../clock.js';
import type { Gaps } from '../slices.js';
import type { ClockResolution } from '../v2types.js';

export function subClock(preferred: string | null | undefined, present: readonly SystemPresence[], g: Gaps, applicability: readonly ApplicabilityRow[] | null = null): ClockResolution {
  if (!present.length) g.add('clock: no stored dasha systems');
  const c = resolveClockV2(preferred, present, applicability);
  if (preferred && c.reason !== 'preferred') g.add(`clock: preferred ${preferred} is not selectable; read on ${c.primary}`);
  return {
    primary: c.primary,
    reason: c.reason,
    confirming: c.confirming,
    applicable: c.applicable,
    notApplicable: c.notApplicable.map((n) => ({ system: n.system, reason: n.cause })),
  };
}
