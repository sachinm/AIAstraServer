/** Client IP selection: CloudFront viewer address first, then the right X-Forwarded-For hop, then the first hop. */
import { describe, it, expect } from 'vitest';
import {
  getClientIp,
  getClientIpWithSource,
  isPrivateOrReserved,
  resolveClientIp,
  stripPort,
} from '../../src/lib/requestMeta.js';

const get = (h: Record<string, string>) => (n: string) => h[n] ?? null;
const lambdaCtx = (sourceIp: string) => JSON.stringify({ http: { sourceIp, method: 'POST' } });
const EDGE = '64.252.70.1'; // a CloudFront edge address (the function URL's peer)

describe('stripPort', () => {
  it('handles IPv4, bracketed IPv6 and CloudFront\'s bare IPv6:port form', () => {
    expect(stripPort('198.51.100.7:46532', true)).toBe('198.51.100.7');
    expect(stripPort('[2001:db8::1]:443', true)).toBe('2001:db8::1');
    expect(stripPort('2001:db8:85a3::8a2e:370:7334:46532', true)).toBe('2001:db8:85a3::8a2e:370:7334');
    expect(stripPort('2001:db8::1')).toBe('2001:db8::1');
    expect(stripPort('198.51.100.7')).toBe('198.51.100.7');
    expect(stripPort('not-an-ip:80', true)).toBeNull();
    expect(stripPort('')).toBeNull();
  });
});

describe('isPrivateOrReserved', () => {
  it.each(['10.1.2.3', '172.16.0.1', '192.168.1.1', '127.0.0.1', '169.254.1.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', 'garbage'])(
    '%s is not a viewer address',
    (ip) => expect(isPrivateOrReserved(ip)).toBe(true)
  );
  it.each(['198.51.100.7', '8.8.8.8', '2001:4860:4860::8888', '172.32.0.1'])('%s is public', (ip) =>
    expect(isPrivateOrReserved(ip)).toBe(false)
  );
});

describe('resolveClientIp', () => {
  it('viewer: CloudFront-Viewer-Address wins over a forged X-Forwarded-For', () => {
    expect(
      resolveClientIp(
        get({ 'cloudfront-viewer-address': '198.51.100.7:51234', 'x-forwarded-for': '6.6.6.6, 198.51.100.7, ' + EDGE })
      )
    ).toEqual({ ip: '198.51.100.7', source: 'viewer' });
  });

  it('xff_right: skips the function URL peer (CloudFront edge) and private hops, ignores a spoofed first hop', () => {
    expect(
      resolveClientIp(
        get({
          'x-forwarded-for': `6.6.6.6, 198.51.100.7, 10.0.0.4, ${EDGE}`,
          'x-amzn-request-context': lambdaCtx(EDGE),
        })
      )
    ).toEqual({ ip: '198.51.100.7', source: 'xff_right' });
  });

  it('xff_right: a chain that does not end in the peer still takes the rightmost public hop', () => {
    expect(
      resolveClientIp(get({ 'x-forwarded-for': '198.51.100.7', 'x-amzn-request-context': lambdaCtx(EDGE) }))
    ).toEqual({ ip: '198.51.100.7', source: 'xff_right' });
  });

  it('xff_first: without the peer we cannot tell our hops apart, so keep the first hop (as before) and mark it', () => {
    expect(resolveClientIp(get({ 'x-forwarded-for': `198.51.100.7, ${EDGE}` }))).toEqual({
      ip: '198.51.100.7',
      source: 'xff_first',
    });
  });

  it('xff_first: every hop is the peer or private', () => {
    expect(
      resolveClientIp(get({ 'x-forwarded-for': `10.0.0.1, ${EDGE}`, 'x-amzn-request-context': lambdaCtx(EDGE) }))
    ).toEqual({ ip: '10.0.0.1', source: 'xff_first' });
  });

  it('socket: no X-Forwarded-For, falls back to x-real-ip, cf-connecting-ip, then the peer', () => {
    expect(resolveClientIp(get({ 'x-real-ip': '198.51.100.8' }))).toEqual({ ip: '198.51.100.8', source: 'socket' });
    expect(resolveClientIp(get({ 'cf-connecting-ip': '198.51.100.9' }))).toEqual({ ip: '198.51.100.9', source: 'socket' });
    expect(resolveClientIp(get({ 'x-amzn-request-context': lambdaCtx(EDGE) }))).toEqual({ ip: EDGE, source: 'socket' });
    expect(resolveClientIp(get({}))).toEqual({ ip: null, source: null });
  });

  it('a malformed request-context header is ignored', () => {
    expect(resolveClientIp(get({ 'x-forwarded-for': '198.51.100.7', 'x-amzn-request-context': '{nope' }))).toEqual({
      ip: '198.51.100.7',
      source: 'xff_first',
    });
  });
});

describe('getClientIp (Fetch Request)', () => {
  it('returns the resolved IP and its source', () => {
    const req = new Request('https://api.example.com/graphql', {
      headers: { 'x-forwarded-for': `198.51.100.7, ${EDGE}`, 'x-amzn-request-context': lambdaCtx(EDGE) },
    });
    expect(getClientIp(req)).toBe('198.51.100.7');
    expect(getClientIpWithSource(req).source).toBe('xff_right');
    expect(getClientIpWithSource(null)).toEqual({ ip: null, source: null });
  });
});
