/**
 * Keys for the web app's encrypted decorative assets (docs/loading-overlay/01 §4.1). Always mounted; needs a user.
 *
 *   GET /api/assets/overlay-key   { key: base64(32 bytes), version }  → 200 | 401 | 404 no_key
 *
 * The loading veil's illustrations ship on the web origin as AES-GCM ciphertext made at build time with
 * OVERLAY_ART_KEY; a signed-in browser fetches the same key here once, decrypts and caches the art itself. The key is
 * the same for every user (the art is not personal); what this buys is a key that is in no bundle and no repository.
 */
import type express from 'express';
import { createHash } from 'node:crypto';
import type { RequireUser } from '../auth/requestAuth.js';
import { overlayArtKey } from '../config/env.js';

export interface AssetRouteDeps {
  requireUser: RequireUser;
  /** tests: the env to read instead of process.env */
  env?: NodeJS.ProcessEnv;
}

/** The version the web build stamps on the ciphertext names the key too; the browser's cache misses on a rotation. */
export function overlayKeyVersion(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

let warned = false;

export function registerAssetRoutes(app: express.Express, deps: AssetRouteDeps): void {
  app.get('/api/assets/overlay-key', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    res.setHeader('Cache-Control', 'private, no-store');
    const key = overlayArtKey(deps.env ?? process.env);
    if (!key) {
      if (!warned) {
        warned = true;
        console.warn('[assets] OVERLAY_ART_KEY unset or not 64 hex chars; the loading veil shows its lines alone');
      }
      return res.status(404).json({ error: 'no_key' });
    }
    return res.json({ key: key.toString('base64'), version: overlayKeyVersion(key) });
  });
}
