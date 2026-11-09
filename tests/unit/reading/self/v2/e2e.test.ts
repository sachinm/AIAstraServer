/**
 * Self board v2 end to end, offline (docs/reading-engine/66 §4.5, §4.8): the research calibration kundli's stored digest,
 * activation, sky and the engine's pressure inventory (fixtures) → the self build event with SELF_V2_BUILD=1 → the real
 * sub-techniques, area briefs, slices, family readers ×5, Oracle ×3, Personalizer (every Gemini call mocked, nothing
 * reaches a provider) → `readSelfV2Latest` → GET /api/self/v2 → twelve areas in board order, a hero, and no chart term,
 * engine name or technique id on any card face. Per-agent timings and tokens (thought tokens included) are recorded.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { digestView } from '../../../../../src/reading/digest/load.js';
import type { ActivationRow } from '../../../../../src/reading/digest/activation.js';
import type { TransitRangePayload } from '../../../../../src/reading/chartData/transitRange.js';
import type { GeminiCallOptions, GeminiResult } from '../../../../../src/reading/llm/gemini.js';
import { clearPendingIndividualRecycles } from '../../../../../src/reading/llm/cacheSweep.js';
import { clearReaderMemo } from '../../../../../src/reading/oracle/prewarm.js';
import { runSelfReadingBuild } from '../../../../../src/reading/self/buildEvent.js';
import type { SelfReadingResult } from '../../../../../src/reading/self/service.js';
import { runSelfV2Build, type SelfV2BuildResult } from '../../../../../src/reading/self/v2/build.js';
import { CHART_TERMS, ENGINE_NAMES, INTERNAL_ID } from '../../../../../src/reading/self/v2/personalizerValidate.js';
import { readSelfV2Latest } from '../../../../../src/reading/self/v2/store.js';
import { toPressureInventory, type EnginePressurePayload } from '../../../../../src/reading/self/sub/pressure.js';
import { SELF_V2_AREAS, type SelfV2Response } from '../../../../../src/reading/self/v2types.js';
import { registerSelfV2Routes } from '../../../../../src/routes/selfV2Routes.js';
import { fakeRequireUser } from '../../../../helpers/fakeAuth.js';
import { makePrisma } from '../v2agents/fixtures.js';

const FIX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../fixtures/self/research-calibration.json'), 'utf8')) as {
  digest: Array<{ section: string; key: string; row: unknown }>;
  activation: ActivationRow[];
  systems: Array<{ system: string; family: string }>;
};
const ENGINE = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../fixtures/self/pressure-inventory.json'), 'utf8')) as EnginePressurePayload;
const ASOF = '2026-11-07';
const NOW = new Date(`${ASOF}T09:00:00Z`);
const view = digestView('k1', FIX.digest as never, { status: 'ready', version: 'd1.test' });
const SKY: TransitRangePayload = {
  from: '2026-11-02',
  to: '2027-11-02',
  planets: ['Sa', 'Ju'],
  natal: { lagna_sign: 'Pisces', lagna_sign_index: 11, moon_sign: 'Scorpio', moon_sign_index: 7 },
  ingresses: [
    { planet: 'Sa', sign: 'Pisces', sign_index: 11, from: '2025-03-29', to: '2027-06-03', starts_before_range: true, retro_on_entry: false, house_from_lagna: 1, house_from_moon: 5 },
    { planet: 'Ju', sign: 'Cancer', sign_index: 3, from: '2026-06-02', to: '2027-06-26', retro_on_entry: false, house_from_lagna: 5, house_from_moon: 9 },
  ],
  stations: [],
  lunations: [],
  eclipses: [],
  sade_sati: [],
  dhaiya: [],
};
const ENV = {
  SELF_V2_BUILD: '1',
  SELF_READING_MODEL: '1',
  READING_EXPLICIT_CACHE: '1',
  READING_MODEL_READER: 'gemini-3.1-flash-lite',
  READING_MODEL_ORACLE: 'gemini-3.8-flash',
  SELF_PERSONALIZER_MODEL: 'gemini-3.1-flash-lite',
  SELF_READING_MAX_SPEND_USD: '1',
} as const;

/** mocked usage per agent: the doc 66 §4.9 estimates, with thought tokens so the run log's field is exercised */
const USAGE = {
  family: { promptTokens: 25_200, cachedTokens: 0, outputTokens: 700, thoughtTokens: 310 },
  oracle: { promptTokens: 11_000, cachedTokens: 8_000, outputTokens: 2_200, thoughtTokens: 420 },
  personalizer: { promptTokens: 8_000, cachedTokens: 6_000, outputTokens: 3_600, thoughtTokens: 0 },
} as const;

const result = (text: string, u: (typeof USAGE)[keyof typeof USAGE]): GeminiResult => ({
  text,
  usage: { node: 'x', model: 'm', ms: 1, ...u },
  finishReason: 'STOP',
  ttftMs: 1,
  stoppedForLoop: false,
});

const keysIn = (text: string): string[] => [...text.matchAll(/\{([^{}\s]+)\}/g)].map((m) => m[1]!);

/** A Gemini mock that answers from what each slice carries: it cites only keys the slice holds, as a model must. */
function gemini(log: string[]) {
  return async (o: GeminiCallOptions): Promise<GeminiResult> => {
    log.push(o.node);
    const text = (o.parts ?? []).join('\n');
    const keys = keysIn(text);
    if (o.node.startsWith('family.')) return result(`- ${o.node} reads the chart {${keys.find((k) => k.startsWith('planet:D1.')) ?? keys[0]}}\nVALID_UNTIL: always`, USAGE.family);
    if (o.node.startsWith('self.oracle.v2.')) {
      const areas = /write only these areas: ([a-z, ]+)\./.exec(text)![1]!.split(', ');
      const planet = keys.find((k) => k.startsWith('planet:D1.'))!;
      const house = keys.find((k) => k.startsWith('house:D1.'))!;
      return result(
        JSON.stringify({
          validUntil: 'always',
          areas: areas.map((a) => {
            const claim = keys.find((k) => k.startsWith(`claim:${a}.`));
            return {
              id: a,
              headline: `Your ${a} asks for steady effort now.`,
              paragraphs: [`The ${a} reading rests on this placement {${planet}}.`, `The ${a} reading also rests on this house {${house}}.`],
              dates: [],
              actions: [],
              certainty: 'strong',
              evidence: [planet, house, ...(claim ? [claim] : [])],
              validUntil: 'always',
            };
          }),
          patterns: [],
        }),
        USAGE.oracle,
      );
    }
    if (o.node === 'self.personalizer') {
      const areas = (o.responseSchema as { properties: { cards: { items: { properties: { areaId: { enum: string[] } } } } } }).properties.cards.items.properties.areaId.enum;
      const claim = keys.find((k) => k.startsWith('claim:stuck.')) ?? keys.find((k) => k.startsWith('claim:'));
      return result(
        JSON.stringify({
          hero: { tone: 'demanding', sentence: 'Work asks more of you than usual for now.', sub: 'It is a stretch to pace, not a verdict.', questionClaimId: claim ?? '', questionText: 'Has work felt heavier lately?', withheld: false },
          cards: areas.map((a) => ({
            areaId: a,
            headline: 'This part of life asks for patience for now.',
            body: ['You carry more than you are thanked for.', 'Finish one thing a week and rest on purpose.'],
            patterns: [{ text: 'You say yes before you ask what it costs.', kind: 'watch', since: '', until: '', source: `${a}.p1` }],
            ladder: { best: 'Do the work and let the credit come late.', practical: 'Put what you agreed in writing.', drift: 'Let it ride and you stay tired.', floor: 'Protect your sleep first.' },
            dates: [],
            sources: [`${a}.p1`, `${a}.p1`, `${a}.p2`],
          })),
        }),
        USAGE.personalizer,
      );
    }
    throw new Error(`unexpected node ${o.node}`);
  };
}

/** the store fixture plus the rows the sub-techniques, the profile and the GET read */
function makeDb() {
  const db = makePrisma();
  const kundli = { id: 'k1', user_id: 'u1', preferred_dasha: 'dwisatpathi', digest_status: 'ready' };
  const markers = new Map<string, Record<string, unknown>>();
  const p = db.prisma as unknown as Record<string, unknown>;
  p.kundli = {
    findUnique: async () => ({ preferred_dasha: kundli.preferred_dasha }),
    findFirst: async ({ where }: { where: { user_id: string } }) => (where.user_id === 'u1' ? { ...kundli } : null),
  };
  p.kundliData = { findFirst: async () => null };
  p.auth = { findUnique: async () => ({ date_of_birth: '1985-03-01', gender: null, role: 'novice' }) };
  p.personFact = { findMany: async () => [{ key: 'work.status', value: 'yes', confirmed_at: NOW, source: 'tapped', user_id: 'u1' }] };
  // the self.reading marker (findUnique) beside the v2 marker (findFirst) the store fixture keeps
  const ab = p.areaBuild as Record<string, (...a: never[]) => unknown>;
  p.areaBuild = {
    ...ab,
    findUnique: async ({ where }: { where: { kundli_id_area_as_of: { kundli_id: string; area: string } } }) => markers.get(`${where.kundli_id_area_as_of.kundli_id}|${where.kundli_id_area_as_of.area}`) ?? null,
    upsert: async (q: { where: { kundli_id_area_as_of: { kundli_id: string; area: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      const k = `${q.where.kundli_id_area_as_of.kundli_id}|${q.where.kundli_id_area_as_of.area}`;
      if (q.where.kundli_id_area_as_of.area === 'self.reading') markers.set(k, { ...(markers.get(k) ?? q.create), ...q.update });
      else await (ab.upsert as unknown as (x: typeof q) => Promise<void>)(q);
    },
  };
  return db;
}

describe('Self v2 end to end on fixtures (SELF_V2_BUILD=1, every model call mocked)', () => {
  const saved: Record<string, string | undefined> = {};
  const log: string[] = [];
  const db = makeDb();
  let v2: SelfV2BuildResult | null = null;
  let body: SelfV2Response;
  let server: ReturnType<express.Express['listen']>;
  let base = '';

  beforeAll(async () => {
    for (const [k, v] of Object.entries(ENV)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    clearReaderMemo();
    clearPendingIndividualRecycles();
    const pressure = toPressureInventory(ENGINE, 'k1').inventory;
    const legacy = { status: 'ok', built_at: ASOF, cached: false, reading: { asOf: ASOF, panels: [], oracle: { status: 'ok', cached: false } } } as unknown as SelfReadingResult;
    await runSelfReadingBuild(
      {
        prisma: db.prisma,
        build: async () => legacy,
        now: () => NOW,
        v2Build: async (prisma, userId, kundliId, asOf) => {
          v2 = await runSelfV2Build(
            {
              prisma,
              callGemini: gemini(log),
              ensureCache: vi.fn(async () => 'cachedContents/mock'),
              informUsed: vi.fn(),
              now: () => NOW,
              sub: {
                loadDigest: async () => view,
                systemsPresent: async () => FIX.systems,
                activationFor: async (_p, _k, q) => FIX.activation.filter((r) => !q.systems || q.systems.includes(r.system)),
                loadTransit: async () => SKY,
                loadPressure: async () => ({ inventory: pressure, source: 'stored', gaps: [] }),
              },
            },
            { userId, kundliId, asOf },
          );
          return v2;
        },
      },
      'u1',
      'k1',
      'self',
    );

    const app = express();
    app.use(express.json());
    registerSelfV2Routes(app, {
      prisma: db.prisma,
      enabled: true,
      requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) ?? null),
      v2: { now: () => NOW, systemsPresent: async () => FIX.systems, loadApplicability: async () => null, queueBuild: async () => 'skipped' },
    });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const r = await fetch(`${base}/api/self/v2`, { headers: { 'x-user': 'u1' } });
    expect(r.status).toBe(200);
    body = (await r.json()) as SelfV2Response;
  });

  afterAll(() => {
    server?.close();
    for (const k of Object.keys(ENV)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    clearReaderMemo();
    clearPendingIndividualRecycles();
  });

  it('the build ran on the engine windows (not degraded) and stored the Oracle and the cards', async () => {
    expect(v2, JSON.stringify(v2?.gaps ?? [])).not.toBeNull();
    expect(v2!.status, v2!.gaps.join('\n')).toBe('ok');
    expect(v2!.stored).toEqual({ oracle: true, cards: true });
    expect(v2!.layers.unkeyed).toEqual([]);
    expect(v2!.gaps.join(' ')).not.toMatch(/windows: .*degraded/);
    const latest = await readSelfV2Latest(db.prisma, 'k1', 'dwisatpathi');
    expect(latest.status).toBe('ok');
    expect(latest.frame?.periods?.runningSub?.to).toBe('2027-01-01');
  });

  it('GET /api/self/v2 answers ok with twelve areas in board order and a hero', () => {
    expect(body.status).toBe('ok');
    expect(body.clock.system).toBe('dwisatpathi');
    expect(body.areas.map((a) => a.id)).toEqual(SELF_V2_AREAS.map((a) => a.id));
    expect(body.areas).toHaveLength(12);
    expect(body.hero).not.toBeNull();
    expect(body.hero!.withheld).toBe(false);
    expect(body.hero!.supporting!.length).toBeGreaterThan(0);
    expect(body.subChapterEnds).toBe('2027-01-01');
    expect(body.profile.role).toBe('public');
    expect(body.areas.filter((a) => a.status === 'ok').length).toBeGreaterThanOrEqual(11);
    expect(body.areas.find((a) => a.id === 'lagna')!.rangeLabel).toBe('Always');
    expect(body.areas.find((a) => a.id === 'chapter')!.rangeLabel).toBe('True until 1 Jan 2027');
  });

  it('no chart term, engine name, internal key or technique id on the hero or any card face', () => {
    const texts: string[] = [];
    const h = body.hero!;
    texts.push(h.sentence, h.sub, h.question?.text ?? '');
    for (const a of body.areas) {
      const c = a.card;
      if (!c) continue;
      texts.push(c.headline, ...c.body, ...c.patterns.map((p) => p.text));
      if (c.ladder) texts.push(c.ladder.best, c.ladder.practical, c.ladder.drift, c.ladder.floor);
      texts.push(...c.dates.map((d) => d.label));
    }
    const TECHNIQUE_ID = /\b(self|family|oracle|work|love)\.[a-z_]+\.[a-z_]+|\bself\.(sub|v2)\b/i;
    for (const t of texts.filter(Boolean)) {
      for (const re of CHART_TERMS) expect(re.test(t), `${t} ~ ${re}`).toBe(false);
      expect(ENGINE_NAMES.test(t), t).toBe(false);
      expect(INTERNAL_ID.test(t), t).toBe(false);
      expect(TECHNIQUE_ID.test(t), t).toBe(false);
    }
    expect(texts.length).toBeGreaterThan(20);
  });

  it('records wall time and tokens per agent call, thought tokens included', () => {
    const calls = v2!.agents;
    expect(calls.map((c) => c.call).sort()).toEqual(['family.dasha', 'family.rasi', 'family.sky', 'family.varga', 'family.year', 'oracle.a', 'oracle.b', 'oracle.c', 'self.personalizer']);
    for (const c of calls) {
      expect(c.status).toBe('ok');
      expect(c.ms).toBeTypeOf('number');
      expect(c.thoughtTokens).toBeTypeOf('number');
      expect(c.costUsd).toBeGreaterThan(0);
    }
    expect(calls.filter((c) => c.agent.startsWith('family.')).every((c) => c.thoughtTokens === USAGE.family.thoughtTokens)).toBe(true);
    expect(calls.filter((c) => c.agent === 'self.oracle').every((c) => c.promptTokens === 11_000 && c.cachedTokens === 8_000 && c.thoughtTokens === 420)).toBe(true);
    expect(log.filter((n) => n.startsWith('family.'))).toHaveLength(5);
    // the figures the report quotes (Lab-style table on the fixture)
    console.log(
      JSON.stringify({
        self_v2_e2e: {
          totalMs: v2!.ms.total,
          subsMs: v2!.ms.subs,
          agents: calls.map((c) => ({ call: c.call, ms: c.ms, in: c.promptTokens, cached: c.cachedTokens, out: c.outputTokens, thought: c.thoughtTokens, usd: c.costUsd })),
          slices: v2!.slices,
        },
      }),
    );
  });

  it('a second build with unchanged stamps stores nothing new and re-runs no agent', async () => {
    const before = db.outputs.size;
    const log2: string[] = [];
    const again = await runSelfV2Build(
      {
        prisma: db.prisma,
        callGemini: gemini(log2),
        ensureCache: vi.fn(async () => 'cachedContents/mock'),
        informUsed: vi.fn(),
        now: () => NOW,
        sub: {
          loadDigest: async () => view,
          systemsPresent: async () => FIX.systems,
          activationFor: async (_p, _k, q) => FIX.activation.filter((r) => !q.systems || q.systems.includes(r.system)),
          loadTransit: async () => SKY,
          loadPressure: async () => ({ inventory: toPressureInventory(ENGINE, 'k1').inventory, source: 'stored', gaps: [] }),
        },
      },
      { userId: 'u1', kundliId: 'k1', asOf: ASOF },
    );
    expect(again.status).toBe('ok');
    expect(log2).toEqual([]);
    expect(again.oracle!.cached).toBe(true);
    expect(again.cards!.cached).toBe(true);
    expect(again.stored).toEqual({ oracle: false, cards: false });
    expect(again.layers.stored).toEqual([]);
    expect(again.layers.unkeyed).toEqual([]);
    expect(again.layers.cached.sort()).toEqual([...v2!.layers.stored].sort());
    expect(again.layers.cached.length).toBeGreaterThanOrEqual(21);
    expect(db.outputs.size).toBe(before);
  });
});

