/**
 * First-party product analytics (docs/reading-engine/49 §4.1): what the person clicks and chooses, per person, so we
 * know which features are used. No free text and no birth data: an event is a known name, a surface, a short target
 * and a few scalar props. Unknown event names are dropped, not stored.
 */
import type { PrismaClient } from '@prisma/client';

/** The known events. Add here before the web sends a new one. */
export const EVENT_NAMES = new Set([
  'page_view',
  'tab_select',
  'view_select',
  'week_select',
  'scenario_add',
  'scenario_remove',
  'scenario_layer_toggle',
  'scenario_answer',
  'place_set',
  'window_open',
  'why_open',
  'add_menu_open',
  'board_open',
  'worry_open',
  'chip_select',
  'question_answer',
]);

export const MAX_EVENTS_PER_CALL = 50;

export interface IncomingEvent {
  event?: unknown;
  surface?: unknown;
  target?: unknown;
  props?: unknown;
  at?: unknown;
}

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Keep only scalar props with short keys and values; drop anything that could be free text over 80 characters. */
export function cleanProps(p: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!p || typeof p !== 'object' || Array.isArray(p)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
    if (n >= 12 || !/^[a-z0-9_]{1,40}$/.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && v.length <= 80) out[k] = v;
    else continue;
    n += 1;
  }
  return out;
}

export function cleanEvents(events: unknown, now: Date = new Date()): Array<{ event: string; surface: string; target: string | null; props: Record<string, string | number | boolean>; at: Date }> {
  if (!Array.isArray(events)) return [];
  const out = [];
  for (const e of events.slice(0, MAX_EVENTS_PER_CALL) as IncomingEvent[]) {
    const event = str(e?.event, 40);
    const surface = str(e?.surface, 60);
    if (!event || !surface || !EVENT_NAMES.has(event)) continue;
    let at = now;
    if (typeof e.at === 'string') {
      const t = new Date(e.at);
      if (!Number.isNaN(t.getTime()) && Math.abs(now.getTime() - t.getTime()) < 24 * 3600 * 1000) at = t;
    }
    out.push({ event, surface, target: str(e.target, 80), props: cleanProps(e.props), at });
  }
  return out;
}

export async function recordEvents(prisma: PrismaClient, userId: string | null, sessionId: unknown, events: unknown): Promise<number> {
  const rows = cleanEvents(events);
  if (rows.length === 0) return 0;
  const session = str(sessionId, 64);
  await prisma.analyticsEvent.createMany({ data: rows.map((r) => ({ ...r, user_id: userId, session_id: session })) });
  return rows.length;
}
