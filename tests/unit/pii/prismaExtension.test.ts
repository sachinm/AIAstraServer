/**
 * docs/privacy/02 B1.2: the Prisma extension seals every mapped field on write (sealed mode), opens it on read, and
 * refuses filters on sealed fields. Runs the extension's query handler against a recording fake `query`, with the
 * generated client's real datamodel for relations. (A round trip against a real test database is still to do:
 * docs/TODOS.md.)
 */
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { activeFields, SEALED_MODELS } from '../../../src/lib/pii/fields.js';
import { LocalKeyProvider, type PiiWriteMode } from '../../../src/lib/pii/keys.js';
import { piiQuery, PiiGuardError, relationMapFromDmmf, type PiiExtensionDeps, type WriteOwner } from '../../../src/lib/pii/prismaExtension.js';
import { isSealed } from '../../../src/lib/pii/seal.js';
import { sourceHash } from '../../../src/reading/data/factsBuilder.js';

const ALICE = '11111111-1111-4111-8111-111111111111';
const keys = new LocalKeyProvider(randomBytes(32));
const relations = relationMapFromDmmf();

function deps(mode: PiiWriteMode, owners: WriteOwner[] = []): PiiExtensionDeps {
  return {
    keys: () => keys,
    writeMode: () => mode,
    keyRefFor: async (o) => {
      owners.push(o);
      return ALICE;
    },
    relations,
  };
}

/** a fake `query` that records the args it got and answers with `answer(args)` */
function recorder(answer: (args: Record<string, unknown>) => unknown = () => null) {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    query: async (args: unknown) => {
      calls.push(args as Record<string, unknown>);
      return answer(args as Record<string, unknown>);
    },
  };
}

const sampleValue = (model: string, field: string, kind: 'text' | 'json') => (kind === 'text' ? `${model}.${field} Zebulon 1987-03-14` : { model, field, asc: 'Leo', n: [1, 2] });

describe('every model in fields.ts round-trips through the extension', () => {
  for (const [model, spec] of Object.entries(SEALED_MODELS)) {
    const fields = activeFields(model);
    if (!Object.keys(fields).length) continue;
    it(`${model} (${spec.table})`, async () => {
      const data: Record<string, unknown> = {};
      for (const [f, c] of Object.entries(fields)) data[f] = sampleValue(model, f, c.kind);
      const r = recorder((args) => structuredClone((args as { data: unknown }).data));
      const opened = (await piiQuery({ model, operation: 'create', args: { data }, query: r.query }, deps('sealed'))) as Record<string, unknown>;
      const written = r.calls[0]!.data as Record<string, unknown>;
      for (const f of Object.keys(fields)) {
        expect(isSealed(written[f]), `${model}.${f} sealed on write`).toBe(true);
        expect(JSON.stringify(written[f])).not.toContain('Zebulon');
      }
      expect(opened).toMatchObject(data);
    });
  }
});

describe('writes', () => {
  it('plain mode (B1, B2): data is written exactly as given', async () => {
    const r = recorder(() => ({ id: 'u1' }));
    const data = { email: 'a@b.co', date_of_birth: '1987-03-14', role: 'user' };
    await piiQuery({ model: 'Auth', operation: 'create', args: { data }, query: r.query }, deps('plain'));
    expect(r.calls[0]!.data).toEqual(data);
  });

  it('sealed mode: plain columns stay plain, the blind index is added, and the owner is looked up once per row', async () => {
    const owners: WriteOwner[] = [];
    const r = recorder(() => ({ id: 'u1' }));
    await piiQuery({ model: 'Auth', operation: 'create', args: { data: { email: 'Asha@Example.com', username: 'asha', role: 'user', date_of_birth: '1990-01-15' } }, query: r.query }, deps('sealed', owners));
    const w = r.calls[0]!.data as Record<string, unknown>;
    expect(w.role).toBe('user');
    expect(isSealed(w.email)).toBe(true);
    expect(w.email_bidx).toMatch(/^[0-9a-f]{64}$/);
    expect(w.username_bidx).toMatch(/^[0-9a-f]{64}$/);
    expect(owners).toHaveLength(1);
  });

  it('seals nested creates, createMany, upsert and `{ set }` updates', async () => {
    const r = recorder(() => ({}));
    const d = deps('sealed');
    await piiQuery({ model: 'Auth', operation: 'create', args: { data: { email: 'x@y.z', kundlis: { create: { biodata: { dob: '1987-03-14' } } } } }, query: r.query }, d);
    const nested = ((r.calls[0]!.data as Record<string, unknown>).kundlis as { create: Record<string, unknown> }).create;
    expect(isSealed(nested.biodata)).toBe(true);

    await piiQuery({ model: 'Message', operation: 'createMany', args: { data: [{ chat_id: 'c', question: 'q1', ai_answer: 'a1' }, { chat_id: 'c', question: 'q2', ai_answer: 'a2' }] }, query: r.query }, d);
    for (const row of r.calls[1]!.data as Array<Record<string, unknown>>) expect(isSealed(row.question) && isSealed(row.ai_answer)).toBe(true);

    await piiQuery({ model: 'KundliData', operation: 'upsert', args: { where: { id: 'k' }, create: { kundli_id: 'k', payload: { a: 1 } }, update: { payload: { a: 2 } } }, query: r.query }, d);
    expect(isSealed((r.calls[2]!.create as Record<string, unknown>).payload)).toBe(true);
    expect(isSealed((r.calls[2]!.update as Record<string, unknown>).payload)).toBe(true);

    await piiQuery({ model: 'Chat', operation: 'update', args: { where: { id: 'c' }, data: { name: { set: 'When will I marry?' } } }, query: r.query }, d);
    expect(isSealed(((r.calls[3]!.data as Record<string, unknown>).name as { set: unknown }).set)).toBe(true);
  });

  it('a global transit snapshot (no owner) stays plain; a person row with no owner key refuses', async () => {
    const r = recorder(() => ({}));
    const none: PiiExtensionDeps = { ...deps('sealed'), keyRefFor: async () => null };
    await piiQuery({ model: 'TransitSnapshot', operation: 'create', args: { data: { snapshot: { sky: 1 } } }, query: r.query }, none);
    expect(r.calls[0]!.data).toEqual({ snapshot: { sky: 1 } });
    await expect(piiQuery({ model: 'Message', operation: 'create', args: { data: { question: 'q' } }, query: r.query }, none)).rejects.toThrow(/PII_UNAVAILABLE/);
  });

  it('sealed mode before B2 (the default owner lookup) refuses instead of writing plaintext', async () => {
    const { defaultPiiDeps } = await import('../../../src/lib/pii/prismaExtension.js');
    const d = { ...defaultPiiDeps(), keys: () => keys, writeMode: () => 'sealed' as const };
    const r = recorder();
    await expect(piiQuery({ model: 'Message', operation: 'create', args: { data: { question: 'q' } }, query: r.query }, d)).rejects.toThrow(/M26/);
    expect(r.calls).toHaveLength(0);
  });
});

describe('reads', () => {
  it('opens sealed values in results, through include relations, and passes plain rows through', async () => {
    const w = recorder((a) => structuredClone((a as { data: unknown }).data));
    const sealedAuth = (await (async () => {
      await piiQuery({ model: 'Auth', operation: 'create', args: { data: { email: 'a@b.co', place_of_birth: 'Pune,IN' } }, query: w.query }, deps('sealed'));
      return w.calls[0]!.data as Record<string, unknown>;
    })());
    await piiQuery({ model: 'KundliData', operation: 'create', args: { data: { payload: { asc: 'Leo' } } }, query: w.query }, deps('sealed'));
    const sealedPayload = (w.calls[1]!.data as Record<string, unknown>).payload;

    const row = { id: 'k1', lat: 18.5, user: { ...sealedAuth, role: 'user' } as Record<string, unknown>, chartData: [{ payload: sealedPayload, status: 'ready' }, { payload: { plain: true }, status: 'ready' }] };
    const r = recorder(() => structuredClone(row));
    const out = (await piiQuery({ model: 'Kundli', operation: 'findUnique', args: { where: { id: 'k1' }, include: { user: true, chartData: true } }, query: r.query }, deps('plain'))) as typeof row;
    expect(out.user.place_of_birth).toBe('Pune,IN');
    expect(out.user.email).toBe('a@b.co');
    expect(out.chartData[0]!.payload).toEqual({ asc: 'Leo' });
    expect(out.chartData[1]!.payload).toEqual({ plain: true });
    expect(out.lat).toBe(18.5);
  });

  it('sealing never changes the facts source hash: it is computed over the opened birth values', async () => {
    const plain = { date_of_birth: '1987-03-14', time_of_birth: '05:42:00', place_of_birth: 'Pune,IN' };
    const w = recorder((a) => structuredClone((a as { data: unknown }).data));
    await piiQuery({ model: 'Auth', operation: 'create', args: { data: plain }, query: w.query }, deps('sealed'));
    const stored = w.calls[0]!.data as Record<string, string>;
    expect(stored.date_of_birth).not.toBe(plain.date_of_birth);
    const r = recorder(() => ({ id: 'k1', user: structuredClone(stored) }));
    const k = (await piiQuery({ model: 'Kundli', operation: 'findUnique', args: { where: { id: 'k1' }, select: { id: true, user: { select: { date_of_birth: true, place_of_birth: true, time_of_birth: true } } } }, query: r.query }, deps('plain'))) as { user: typeof plain };
    const before = sourceHash([plain.date_of_birth, plain.time_of_birth, plain.place_of_birth, 3]);
    expect(sourceHash([k.user.date_of_birth, k.user.time_of_birth, k.user.place_of_birth, 3])).toBe(before);
  });
});

describe('guard', () => {
  const run = (model: string, operation: string, args: Record<string, unknown>, mode: PiiWriteMode = 'plain') => {
    const r = recorder(() => []);
    return { r, p: piiQuery({ model, operation, args, query: r.query }, deps(mode)) };
  };

  it('throws on a where, orderBy, cursor, distinct or groupBy naming a sealed field', async () => {
    await expect(run('Message', 'findMany', { where: { question: { contains: 'marry' } } }).p).rejects.toBeInstanceOf(PiiGuardError);
    await expect(run('Auth', 'findMany', { where: { date_of_birth: '1987-03-14' } }).p).rejects.toThrow(/PII_GUARD/);
    await expect(run('Auth', 'findMany', { orderBy: { name: 'asc' } }).p).rejects.toThrow(/orderBy/);
    await expect(run('Auth', 'findMany', { orderBy: [{ created_at: 'desc' }, { city: 'asc' }] }).p).rejects.toThrow(/PII_GUARD/);
    await expect(run('Chat', 'findMany', { distinct: ['name'] }).p).rejects.toThrow(/distinct/);
    await expect(run('ReadingRun', 'groupBy', { by: ['question'] }).p).rejects.toThrow(/groupBy/);
  });

  it('follows relations: nested where, relation filters, and include arguments', async () => {
    await expect(run('Kundli', 'findMany', { where: { user: { place_of_birth: 'Pune,IN' } } }).p).rejects.toThrow(/Auth\.place_of_birth/);
    await expect(run('Chat', 'findMany', { where: { messages: { some: { ai_answer: { contains: 'x' } } } } }).p).rejects.toThrow(/Message\.ai_answer/);
    await expect(run('Chat', 'findMany', { include: { messages: { where: { question: 'x' } } } }).p).rejects.toThrow(/Message\.question/);
    await expect(run('Auth', 'findMany', { where: { OR: [{ id: 'x' }, { name: 'Zeb' }] } }).p).rejects.toThrow(/Auth\.name/);
  });

  it('allows null checks and plain columns', async () => {
    const ok = run('Kundli', 'findMany', { where: { user_id: 'u', biodata: { not: null }, last_sync_error: null, queue_status: 'pending' }, orderBy: { created_at: 'desc' } });
    await expect(ok.p).resolves.toEqual([]);
    expect(ok.r.calls[0]!.where).toEqual({ user_id: 'u', biodata: { not: null }, last_sync_error: null, queue_status: 'pending' });
  });

  it('email/username equality: unchanged on plain rows, rewritten to the blind index once sealed; other operators throw', async () => {
    const plain = run('Auth', 'findFirst', { where: { email: { equals: 'Asha@Example.com', mode: 'insensitive' } } });
    await plain.p;
    expect(plain.r.calls[0]!.where).toEqual({ email: { equals: 'Asha@Example.com', mode: 'insensitive' } });

    const sealed = run('Auth', 'findFirst', { where: { email: { equals: 'Asha@Example.com', mode: 'insensitive' }, locked_at: null } }, 'sealed');
    await sealed.p;
    const where = sealed.r.calls[0]!.where as Record<string, unknown>;
    expect(where.email).toBeUndefined();
    expect(where.email_bidx).toMatch(/^[0-9a-f]{64}$/);
    expect(where.locked_at).toBeNull();

    await expect(run('Auth', 'findMany', { where: { username: { contains: 'ash' } } }).p).rejects.toBeInstanceOf(PiiGuardError);
  });

  it('models outside the map are not touched', async () => {
    const r = run('ChartDataType', 'findMany', { where: { id: 'facts' }, orderBy: { id: 'asc' } });
    await expect(r.p).resolves.toEqual([]);
  });
});
