/**
 * HTTP surface of the personalization wizard (docs/reading-engine/52 §5). Always mounted; every route needs a user.
 *
 *   GET    /api/profile/facts            { facts, wizard: { done, skipped } }
 *   PUT    /api/profile/facts            { facts: { key: value | null } } → 204 | 400
 *   POST   /api/profile/photo            raw image/jpeg body (≤150 KB), header x-face-box → 201 | 400 | 413 | 429
 *   GET    /api/profile/photo            the JPEG for the signed-in person only → 200 | 404
 *   DELETE /api/profile/photo?restore=1  → 204 | 404
 */
import express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { RequireUser } from '../auth/requestAuth.js';
import { readFacts, writeFacts } from '../profile/facts.js';
import { PHOTO_MAX_BYTES, readPhoto, removePhoto, savePhoto, type SharpFn } from '../profile/photo.js';

export interface ProfileRouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
  /** tests: a stand-in for sharp */
  sharp?: SharpFn;
}

const PHOTO_STATUS: Record<string, [number, string]> = {
  too_big: [413, 'Please use a smaller photo.'],
  not_jpeg: [400, 'That photo could not be read.'],
  bad_image: [400, 'That photo could not be read.'],
  bad_size: [400, 'That photo could not be read.'],
  no_face: [400, 'We could not see a face. Look at the camera and try again.'],
  rate_limited: [429, 'Too many photos for now. Try again later.'],
};

import { factsFromExpress, recordAccountEvent } from '../audit/accountEvents.js';

export function registerProfileRoutes(app: express.Express, deps: ProfileRouteDeps): void {
  app.get('/api/profile/facts', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    try {
      return res.json(await readFacts(deps.prisma, userId));
    } catch (e) {
      console.error('[profile]', (e as Error).message);
      return res.status(500).json({ error: 'profile_failed' });
    }
  });

  app.put('/api/profile/facts', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    try {
      const r = await writeFacts(deps.prisma, userId, (req.body as { facts?: unknown })?.facts);
      const sent = (req.body as { facts?: unknown })?.facts;
      void recordAccountEvent(deps.prisma, {
        userId,
        action: 'facts_update',
        outcome: r.ok ? 'ok' : 'failed',
        fields: sent && typeof sent === 'object' ? Object.keys(sent as object).slice(0, 40) : [],
        note: r.ok ? null : r.error,
        request: factsFromExpress(req),
      });
      return r.ok ? res.status(204).end() : res.status(400).json({ error: r.error });
    } catch (e) {
      console.error('[profile]', (e as Error).message);
      return res.status(500).json({ error: 'profile_failed' });
    }
  });

  app.post('/api/profile/photo', express.raw({ type: ['image/jpeg', 'application/octet-stream'], limit: PHOTO_MAX_BYTES + 1024 }), async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    try {
      const r = await savePhoto(deps.prisma, userId, body, req.headers['x-face-box'], { sharp: deps.sharp });
      void recordAccountEvent(deps.prisma, { userId, action: 'photo_upload', outcome: r.status === 'ok' ? 'ok' : r.status === 'rate_limited' ? 'refused' : 'failed', note: r.status === 'ok' ? null : r.status, request: factsFromExpress(req) });
      if (r.status === 'ok') return res.status(201).json({ width: r.width, height: r.height });
      const [code, message] = PHOTO_STATUS[r.status]!;
      return res.status(code).json({ error: r.status, message });
    } catch (e) {
      console.error('[profile photo]', (e as Error).message);
      return res.status(500).json({ error: 'photo_failed' });
    }
  });

  app.get('/api/profile/photo', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const p = await readPhoto(deps.prisma, userId).catch(() => null);
    if (!p) return res.status(404).json({ error: 'no_photo' });
    res.setHeader('Content-Type', p.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(p.bytes);
  });

  app.delete('/api/profile/photo', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const ok = await removePhoto(deps.prisma, userId, req.query.restore === '1').catch(() => false);
    void recordAccountEvent(deps.prisma, { userId, action: req.query.restore === '1' ? 'photo_restore' : 'photo_remove', outcome: ok ? 'ok' : 'failed', request: factsFromExpress(req) });
    return ok ? res.status(204).end() : res.status(404).json({ error: 'no_photo' });
  });
}
