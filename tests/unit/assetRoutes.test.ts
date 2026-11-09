import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import { registerAssetRoutes, overlayKeyVersion } from '../../src/routes/assetRoutes.js';
import { overlayArtKey } from '../../src/config/env.js';
import { fakeRequireUser } from '../helpers/fakeAuth.js';

const HEX = 'a'.repeat(32) + 'b'.repeat(32);

let server: ReturnType<express.Express['listen']>;
let base = '';
const env: NodeJS.ProcessEnv = {};
beforeAll(async () => {
  const app = express();
  registerAssetRoutes(app, { requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) || null), env });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const get = (user: string | null) => fetch(`${base}/api/assets/overlay-key`, { headers: user ? { 'x-user': user } : {} });

describe('overlayArtKey', () => {
  it('accepts 64 hex chars and nothing else', () => {
    expect(overlayArtKey({ OVERLAY_ART_KEY: HEX })?.length).toBe(32);
    expect(overlayArtKey({ OVERLAY_ART_KEY: ` ${HEX} ` })?.length).toBe(32);
    expect(overlayArtKey({ OVERLAY_ART_KEY: HEX.slice(0, 60) })).toBeNull();
    expect(overlayArtKey({ OVERLAY_ART_KEY: 'zz' + HEX.slice(2) })).toBeNull();
    expect(overlayArtKey({})).toBeNull();
  });
});

describe('GET /api/assets/overlay-key', () => {
  it('needs a user', async () => {
    expect((await get(null)).status).toBe(401);
  });
  it('is 404 no_key when the key is not configured, and never cached', async () => {
    delete env.OVERLAY_ART_KEY;
    const r = await get('u1');
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: 'no_key' });
    expect(r.headers.get('cache-control')).toBe('private, no-store');
  });
  it('hands a signed-in session the key as base64 with the version the web build stamps', async () => {
    env.OVERLAY_ART_KEY = HEX;
    const r = await get('u1');
    expect(r.status).toBe(200);
    const body = (await r.json()) as { key: string; version: string };
    expect(Buffer.from(body.key, 'base64').toString('hex')).toBe(HEX);
    expect(body.version).toBe(overlayKeyVersion(Buffer.from(HEX, 'hex')));
    expect(body.version).toMatch(/^[0-9a-f]{8}$/);
    expect(r.headers.get('cache-control')).toBe('private, no-store');
  });
});
