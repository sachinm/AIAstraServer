/**
 * S1 `self.sub.clock` (docs/reading-engine/66 §4.8): the primary dasha clock and the clocks that confirm it. Reuses
 * `resolveClock` (preferred → first conditional system the engine marks applicable → Vimshottari). Applicability is the
 * engine's `dasha.applicable` verdict as `defaultSystemsPresent` carries it: a conditional system the engine does not
 * mark applicable comes back with family 'other'.
 */
import { resolveClock, type SystemPresence } from '../clock.js';
import type { Gaps } from '../slices.js';
import type { ClockResolution } from '../v2types.js';

export function subClock(preferred: string | null | undefined, present: readonly SystemPresence[], g: Gaps): ClockResolution {
  if (!present.length) g.add('clock: no stored dasha systems');
  const c = resolveClock(preferred, present);
  if (preferred && c.reason !== 'preferred') g.add(`clock: preferred ${preferred} has no stored periods`);
  return {
    primary: c.system,
    reason: c.reason === 'applicable' ? 'conditional_applies' : c.reason,
    confirming: c.confirming.map((x) => x.system),
    applicable: present.filter((p) => p.family !== 'other').map((p) => p.system),
    notApplicable: present.filter((p) => p.family === 'other').map((p) => ({ system: p.system, reason: 'not_marked_applicable_by_engine' })),
  };
}
