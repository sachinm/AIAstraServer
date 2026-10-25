/**
 * `getChartData`: the tool agents use to ask for chart data (docs/reading-engine/20 §5). It goes through
 * ensureChartData, so agents never call Radha directly and everything they fetch is stored once.
 */
import type { PrismaClient } from '@prisma/client';
import { BUILTIN_CHART_TYPES } from './catalog.js';
import { ensureChartData, prismaChartDataRepo, type ChartItem, type EnsureDeps, type EnsureOptions } from './store.js';

export const MAX_ITEMS_PER_CALL = 12;

/** Function-declaration shape (Gemini / OpenAI style) for agents that call tools. */
export const getChartDataTool = {
  name: 'getChartData',
  description:
    'Fetch chart data for the person being read. Pass the type ids you need, e.g. "varga.d10", "dasha.vimsottari", ' +
    '"strength.shadbala", or "annual.varsha@2027" for a yearly item. Returns each item with status ready, missing, failed ' +
    'or unsupported. Ask only for what the question needs.',
  parameters: {
    type: 'object',
    properties: {
      types: {
        type: 'array',
        items: { type: 'string', enum: undefined as string[] | undefined },
        maxItems: MAX_ITEMS_PER_CALL,
        description: 'Chart data type ids (append @<year> for annual items).',
      },
    },
    required: ['types'],
  },
} as const;

/** Known ids, for prompts that list what can be asked for. */
export function chartDataTypeIds(): string[] {
  return BUILTIN_CHART_TYPES.map((t) => (t.variantKind === 'year' ? `${t.id}@<year>` : t.id));
}

export interface ToolResult {
  items: Record<string, Pick<ChartItem, 'status' | 'payload' | 'error'>>;
  truncated: boolean;
}

/** Handler: validates the arguments and runs ensureChartData for the kundli the reading belongs to. */
export async function runGetChartData(deps: EnsureDeps, kundliId: string, args: unknown, opts: EnsureOptions = {}): Promise<ToolResult> {
  const raw = (args as { types?: unknown })?.types;
  const list = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 64) : [];
  const types = [...new Set(list)].slice(0, MAX_ITEMS_PER_CALL);
  const result = await ensureChartData(deps, kundliId, types, opts);
  const items = Object.fromEntries(
    Object.entries(result).map(([k, v]) => [k, { status: v.status, payload: v.payload, ...(v.error ? { error: v.error } : {}) }])
  );
  return { items, truncated: list.length > types.length };
}

export function chartDataDeps(prisma: PrismaClient): EnsureDeps {
  return { repo: prismaChartDataRepo(prisma) };
}
