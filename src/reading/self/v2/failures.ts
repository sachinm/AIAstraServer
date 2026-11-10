/**
 * Validation failures of the Self v2 build, stored and bubbled up (Sachin 2026-11-09: "if there's an error it should
 * store that error and bubble it up to inform some action being taken about the Oracle").
 *
 * - The validators keep writing their findings as words (`gaps`); this module reads each finding into a structured
 *   `ValidationIssue` (area, check, message) without touching the validators' rules.
 * - `recordValidationIssues` writes them to `reading_validation_failures` (migration
 *   20261109120000_reading_validation_failures): one row per finding per build, with the per-area status after the
 *   repair pass, the model, the prompt hash and the call id. The rows hold no words of the person (validator reasons
 *   quote evidence keys, chart words and Oracle date labels only), so the table is not in SEALED_MODELS.
 * - One JSON log line per build (`self.v2 validation`) so an alarm can fire on failed areas.
 *
 * Never throws.
 */
import type { PrismaClient } from '@prisma/client';
import { SELF_V2_AREAS, type OracleAreaStatus, type SelfV2AreaId, type SelfV2Quality, type ValidationCheck, type ValidationIssue } from '../v2types.js';

/** the board needs at least this many Oracle areas ok or repaired (and the hero) to count as served and be charged */
export const SERVE_MIN_AREAS = 8;
/** the longest message stored per finding */
export const MESSAGE_MAX = 300;

const AREA_IDS = new Set<string>(SELF_V2_AREAS.map((a) => a.id));

/** The area a finding names (`<area>: …`), 'hero' for the hero, or null for the document as a whole. */
export function areaOfGap(gap: string): string | null {
  const head = /^([a-z_]+):/.exec(gap)?.[1];
  if (!head) return null;
  return head === 'hero' || AREA_IDS.has(head) ? head : null;
}

/** The Oracle validator's finding (areaDoc.ts `validateAreaDoc`, oracle.ts `validatePatterns`) as a check. */
export function oracleCheckOf(gap: string): ValidationCheck {
  if (/cited an unknown key|evidence keys not in the brief/.test(gap)) return 'unknown_evidence_key';
  if (/^[a-z_]+: pattern|^pattern |a pattern without/.test(gap)) return 'pattern';
  if (/outside every stored window|is not a stored span|does not start today or on a stored edge/.test(gap)) return 'date_not_stored';
  if (/headline cut|headline over|runs over \d+ words/.test(gap)) return 'cap';
  if (/: withheld \(/.test(gap)) return 'withheld';
  if (/repeated another area/.test(gap)) return 'duplicate_paragraph';
  if (/returned twice/.test(gap)) return 'duplicate_area';
  if (/not a panel of this board/.test(gap)) return 'not_a_panel';
  if (/validUntil/.test(gap)) return 'valid_until';
  return 'other';
}

/** The Personalizer validator's finding (personalizerValidate.ts) as a check. */
export function personalizerCheckOf(gap: string): ValidationCheck {
  if (/illustration/.test(gap)) return 'illustration';
  if (/flag: the card repeats/.test(gap)) return 'echo_flag';
  if (/not an area of the Oracle document/.test(gap)) return 'not_an_area';
  if (/returned twice/.test(gap)) return 'duplicate';
  if (/no source in the Oracle document/.test(gap)) return 'no_source';
  if (/engine name/.test(gap)) return 'engine_name';
  if (/internal id/.test(gap)) return 'internal_id';
  if (/chart term/.test(gap)) return 'chart_term';
  if (/medical word/.test(gap)) return 'medical';
  if (/diet or medicine/.test(gap)) return 'diet_advice';
  if (/role word/.test(gap)) return 'role_word';
  if (/career-stage word/.test(gap)) return 'stage_word';
  if (/gendered word/.test(gap)) return 'gendered';
  if (/(date|month|year) \S+ is not in the Oracle|not a window of the Oracle|a date not in the Oracle/.test(gap)) return 'date';
  if (/headline replaced/.test(gap)) return 'headline_replaced';
  if (/over \d+ words|more than one sentence/.test(gap)) return 'cap';
  if (/withheld/.test(gap)) return 'withheld';
  if (/question/.test(gap)) return 'question';
  if (/stated focus/.test(gap)) return 'focus';
  if (/tone/.test(gap)) return 'tone';
  return 'other';
}

/** Findings in words → structured issues. */
export function issuesFromGaps(stage: ValidationIssue['stage'], gaps: readonly string[], callId: string | null): ValidationIssue[] {
  return gaps.map((g) => ({
    stage,
    area: areaOfGap(g),
    check: stage === 'oracle' ? oracleCheckOf(g) : personalizerCheckOf(g),
    message: g.slice(0, MESSAGE_MAX),
    callId,
  }));
}

/** The Oracle's quality from its per-area status. */
export function qualityOf(areaStatus: Partial<Record<SelfV2AreaId, OracleAreaStatus>> | undefined): SelfV2Quality {
  const by = (s: OracleAreaStatus) => (Object.entries(areaStatus ?? {}) as Array<[SelfV2AreaId, OracleAreaStatus]>).filter(([, v]) => v === s).map(([id]) => id);
  return { okAreas: by('ok'), repaired: by('repaired'), failed: by('failed') };
}

/**
 * The charge rule (docs/billing/03, unchanged; defined 2026-11-09): a build serves the page when the hero stands and at
 * least SERVE_MIN_AREAS of the eleven Oracle areas are ok or repaired. Only a build that serves the page is `ok`, is
 * stored as the newest reading and commits a held question; otherwise the question is given back.
 */
export function servesPage(q: SelfV2Quality, heroStands: boolean): boolean {
  return heroStands && q.okAreas.length + q.repaired.length >= SERVE_MIN_AREAS;
}

export interface RecordMeta {
  userId: string;
  kundliId: string;
  board: string;
  buildId: string;
  model: string;
  promptHash: string;
}

type FailurePrisma = { readingValidationFailure?: { createMany?: (q: { data: Array<Record<string, unknown>> }) => Promise<unknown> } };

/**
 * Writes one row per finding to `reading_validation_failures`. The Prisma delegate is reached structurally, so a client
 * generated before the migration simply writes nothing (the log line still goes out). Never throws.
 */
export async function recordValidationIssues(prisma: PrismaClient, meta: RecordMeta, issues: readonly ValidationIssue[]): Promise<number> {
  if (!issues.length) return 0;
  try {
    const delegate = (prisma as unknown as FailurePrisma).readingValidationFailure;
    if (!delegate?.createMany) return 0;
    await delegate.createMany({
      data: issues.map((i) => ({
        user_id: meta.userId,
        kundli_id: meta.kundliId,
        board: meta.board,
        build_id: meta.buildId,
        stage: i.stage,
        area: i.area,
        check: i.check,
        message: i.message.slice(0, MESSAGE_MAX),
        area_status: i.areaStatus ?? null,
        model: meta.model,
        prompt_hash: meta.promptHash,
        call_id: i.callId,
      })),
    });
    return issues.length;
  } catch (e) {
    console.warn(JSON.stringify({ msg: 'self.v2 validation failures not stored', kundliId: meta.kundliId, error: (e as Error).message?.slice(0, 200) }));
    return 0;
  }
}

/** One log line per build stage: counts by check, and the failed areas (the alarm's input). */
export function logValidation(meta: Pick<RecordMeta, 'kundliId' | 'buildId'>, stage: ValidationIssue['stage'], issues: readonly ValidationIssue[], quality?: SelfV2Quality): void {
  const byCheck: Record<string, number> = {};
  for (const i of issues) byCheck[i.check] = (byCheck[i.check] ?? 0) + 1;
  console.log(
    JSON.stringify({
      msg: 'self.v2 validation',
      stage,
      kundliId: meta.kundliId,
      buildId: meta.buildId,
      findings: issues.length,
      byCheck,
      ...(quality ? { ok: quality.okAreas.length, repaired: quality.repaired, failed: quality.failed } : {}),
    }),
  );
}
