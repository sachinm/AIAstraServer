import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import { registerProfileRoutes } from '../../../src/routes/profileRoutes.js';
import { averageHash, checkFaceBox, PHOTO_LIMIT_HOUR } from '../../../src/profile/photo.js';
import { checkFact } from '../../../src/profile/facts.js';
import { fakeRequireUser } from '../../helpers/fakeAuth.js';

const facts = new Map<string, any>();
const photos = new Map<string, any>();
const attempts: any[] = [];
const prisma: any = {
  personFact: {
    findMany: async ({ where }: any) => [...facts.values()].filter((f) => f.user_id === where.user_id),
    upsert: async ({ where, create, update }: any) => {
      const k = `${where.user_id_key.user_id}:${where.user_id_key.key}`;
      facts.set(k, { ...(facts.get(k) ?? create), ...(facts.has(k) ? update : {}) });
    },
  },
  profilePhoto: {
    findUnique: async ({ where }: any) => photos.get(where.user_id) ?? null,
    upsert: async ({ where, create, update }: any) => photos.set(where.user_id, photos.has(where.user_id) ? { ...photos.get(where.user_id), ...update } : create),
    update: async ({ where, data }: any) => photos.set(where.user_id, { ...photos.get(where.user_id), ...data }),
    delete: async ({ where }: any) => photos.delete(where.user_id),
  },
  profilePhotoAttempt: {
    count: async ({ where }: any) => attempts.filter((a) => a.user_id === where.user_id && a.at >= where.at.gte).length,
    create: async ({ data }: any) => attempts.push(data),
  },
};

/** A stand-in for sharp: reads the size from the first bytes the test writes (bytes 2-3 = width/8). */
const sharp: any = (buf: Buffer) => {
  const chain: any = {
    metadata: async () => {
      if (buf[2] === 0xee) throw new Error('corrupt');
      return { format: 'jpeg', width: buf[3]! * 8, height: buf[3]! * 8 };
    },
    rotate: () => chain,
    resize: (w: number) => ((chain.w = w), chain),
    greyscale: () => chain,
    jpeg: () => chain,
    raw: () => chain,
    toBuffer: async () => (chain.w === 8 ? Buffer.alloc(64, 7) : Buffer.from([0xff, 0xd8, 1, 2, 3])),
  };
  return chain;
};

const jpeg = (side: number, size = 2000) => {
  const b = Buffer.alloc(size, 1);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0;
  b[3] = side / 8;
  return b;
};
const FACE = JSON.stringify({ x: 0.3, y: 0.25, w: 0.4, h: 0.5, score: 0.95 });

let server: ReturnType<express.Express['listen']>;
let base = '';
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  registerProfileRoutes(app, { prisma, requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) || null), sharp });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const put = (user: string, f: unknown) => fetch(`${base}/api/profile/facts`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-user': user }, body: JSON.stringify({ facts: f }) });
const photo = (user: string, body: Buffer, face: string | null = FACE) =>
  fetch(`${base}/api/profile/photo`, { method: 'POST', headers: { 'content-type': 'image/jpeg', 'x-user': user, ...(face ? { 'x-face-box': face } : {}) }, body: new Uint8Array(body) });

describe('wizard facts', () => {
  it('stores known answers and "rather not say" as declined; refuses unknown keys and values', async () => {
    expect((await put('u1', { 'work.status': 'between_jobs', 'love.status': null, 'self.focus': 'career, love' })).status).toBe(204);
    expect((await put('u1', { 'blood.type': 'O' })).status).toBe(400);
    expect((await put('u1', { 'love.status': 'polyamorous-astronaut' })).status).toBe(400);
    expect((await put('u1', { 'self.focus': 'career,money,love,home' })).status).toBe(400);
    const r = (await (await fetch(`${base}/api/profile/facts`, { headers: { 'x-user': 'u1' } })).json()) as any;
    expect(r.facts['work.status'].value).toBe('between_jobs');
    expect(r.facts['love.status'].value).toBe('declined');
    expect(r.facts['self.focus'].value).toBe('career,love');
    expect(r.wizard).toEqual({ done: null, skipped: null });
  });
  it('checks values without the database', () => {
    expect(checkFact('work.level', 'manager')).toEqual({ ok: true, value: 'manager' });
    expect(checkFact('place.current', 'x'.repeat(200)).ok).toBe(false);
  });
});

describe('selfie', () => {
  it('accepts a square JPEG with one central face, re-encodes it, serves it to the owner only', async () => {
    expect((await photo('u2', jpeg(512))).status).toBe(201);
    const own = await fetch(`${base}/api/profile/photo`, { headers: { 'x-user': 'u2' } });
    expect(own.status).toBe(200);
    expect(own.headers.get('content-type')).toBe('image/jpeg');
    expect(own.headers.get('cache-control')).toBe('private, max-age=3600');
    expect((await fetch(`${base}/api/profile/photo`, { headers: { 'x-user': 'u3' } })).status).toBe(404);
    expect(photos.get('u2').phash).toHaveLength(16);
    expect(facts.get('u2:wizard.selfie').value).toBe('done');
  });
  it('refuses no face, a small or off-centre face, a non-JPEG, a corrupt image, a wrong size, a big file', async () => {
    expect((await photo('u4', jpeg(512), null)).status).toBe(400);
    expect((await photo('u4', jpeg(512), JSON.stringify({ x: 0.0, y: 0.0, w: 0.1, h: 0.1, score: 0.9 }))).status).toBe(400);
    expect((await photo('u4', Buffer.from('GIF89a........'))).status).toBe(400);
    const bad = jpeg(512);
    bad[2] = 0xee;
    expect((await photo('u4', bad)).status).toBe(400);
    expect((await photo('u5', jpeg(128))).status).toBe(400);
    expect((await photo('u5', jpeg(512, 160 * 1024))).status).toBe(413);
  });
  it('limits captures to 5 an hour', async () => {
    for (let i = 0; i < PHOTO_LIMIT_HOUR; i++) await photo('u6', jpeg(512));
    const r = await photo('u6', jpeg(512));
    expect(r.status).toBe(429);
    expect(((await r.json()) as any).message).toContain('Too many photos');
  });
  it('restores the previous photo within 30 days', async () => {
    await photo('u7', jpeg(512));
    await photo('u7', jpeg(512));
    expect(photos.get('u7').prev_bytes).toBeTruthy();
    expect((await fetch(`${base}/api/profile/photo?restore=1`, { method: 'DELETE', headers: { 'x-user': 'u7' } })).status).toBe(204);
    expect(photos.get('u7').prev_bytes).toBeNull();
  });
  it('face box and hash helpers', () => {
    expect(checkFaceBox(FACE)).not.toBeNull();
    expect(checkFaceBox('not json')).toBeNull();
    expect(averageHash(new Uint8Array(64).fill(5))).toBe('ffffffffffffffff');
  });
});
