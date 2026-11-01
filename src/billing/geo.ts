/** Where a request comes from. CloudFront replaces this header, so a viewer cannot set it. */
import type express from 'express';
import type { Region } from './plans.js';

export function viewerCountry(req: express.Request, env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = req.headers['cloudfront-viewer-country'];
  const header = Array.isArray(raw) ? raw[0] : raw;
  const value = header?.trim() || env.DEV_GEO_COUNTRY?.trim() || '';
  return /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : null;
}

/** A paying account's country wins, then the homepage switch, then the viewer's country. Only India gets rupees. */
export function pickRegion(opts: { billingCountry?: string | null; requested?: unknown; country?: string | null }): Region {
  if (opts.billingCountry) return opts.billingCountry === 'IN' ? 'IN' : 'US';
  if (opts.requested === 'IN' || opts.requested === 'US') return opts.requested;
  return opts.country === 'IN' ? 'IN' : 'US';
}
