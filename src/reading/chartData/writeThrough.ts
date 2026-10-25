/**
 * Dual write while the vertical store and the legacy kundlis columns both exist (docs/reading-engine/20 §4 step 3-4):
 * every column the kundli queue fills is also stored as a kundli_data row. Best effort; when the M7 tables are not
 * there yet it logs once and stops trying for this process.
 */
import type { PrismaClient } from '@prisma/client';
import { BUILTIN_CHART_TYPES } from './catalog.js';
import { prismaChartDataRepo } from './store.js';

const TYPE_BY_COLUMN = new Map(BUILTIN_CHART_TYPES.filter((t) => t.legacyColumn).map((t) => [t.legacyColumn!, t]));
let disabled = false;

export function resetWriteThrough(): void {
  disabled = false;
}

export async function writeLegacyColumnsThrough(prisma: PrismaClient, kundliId: string, columns: Record<string, unknown>): Promise<number> {
  if (disabled || process.env.KUNDLI_DATA_WRITE_THROUGH === '0') return 0;
  const repo = prismaChartDataRepo(prisma);
  let written = 0;
  for (const [column, payload] of Object.entries(columns)) {
    const type = TYPE_BY_COLUMN.get(column);
    if (!type || payload == null) continue;
    try {
      await repo.complete(kundliId, { dataType: type.id, variant: '' }, 'LAHIRI', { status: 'ready', payload, calcVersion: type.calcVersion });
      written += 1;
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'P2021' || /does not exist/i.test(e.message ?? '')) {
        disabled = true;
        console.warn(JSON.stringify({ msg: 'kundli_data table missing (M7 not applied); write-through off for this process' }));
        return written;
      }
      console.warn(JSON.stringify({ msg: 'kundli_data write-through failed', kundli_id: kundliId, column, error: e.message?.slice(0, 200) }));
    }
  }
  return written;
}
