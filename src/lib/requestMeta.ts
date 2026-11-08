import { isIP } from 'node:net';

/**
 * Where the client IP came from, best first:
 * - `viewer`: CloudFront-Viewer-Address, set by CloudFront itself (only reaches us once the origin request policy
 *   forwards it; see docs/TODOS.md). The only source a client cannot forge.
 * - `xff_right`: the rightmost public X-Forwarded-For hop that is not the peer that connected to the Lambda function URL
 *   (that peer is the CloudFront edge, read from the `x-amzn-request-context` header the Lambda Web Adapter adds).
 * - `xff_first`: the first X-Forwarded-For hop, used when we cannot tell which hops our own proxies added. Spoofable.
 * - `socket`: no X-Forwarded-For; the peer address (x-real-ip, cf-connecting-ip or the function URL's sourceIp).
 */
export type ClientIpSource = 'viewer' | 'xff_right' | 'xff_first' | 'socket';

export interface ClientIp {
  ip: string | null;
  source: ClientIpSource | null;
}

type HeaderGet = (name: string) => string | null | undefined;

const truncateIp = (ip: string): string => (ip.length > 45 ? ip.slice(0, 45) : ip);

/**
 * "1.2.3.4:5678" | "[2001:db8::1]:443" | "1.2.3.4" | "2001:db8::1" -> the bare address, or null.
 * `portAlwaysPresent` is for CloudFront-Viewer-Address, whose IPv6 form is "2001:db8::1:443" (no brackets): a valid
 * IPv6 address on its own, so the last group is the port only because CloudFront always appends one.
 */
export function stripPort(raw: string | null | undefined, portAlwaysPresent = false): string | null {
  const v = raw?.trim();
  if (!v) return null;
  const bracket = /^\[([^\]]+)\](?::\d+)?$/.exec(v);
  if (bracket) return isIP(bracket[1]) ? bracket[1] : null;
  if (!portAlwaysPresent && isIP(v)) return v;
  const i = v.lastIndexOf(':');
  if (i > 0 && /^\d+$/.test(v.slice(i + 1))) {
    const host = v.slice(0, i);
    if (isIP(host)) return host;
  }
  return portAlwaysPresent && isIP(v) === 4 ? v : null;
}

function ipv4Parts(ip: string): number[] | null {
  if (isIP(ip) !== 4) return null;
  return ip.split('.').map(Number);
}

/** Private, loopback, link-local, CGNAT, documentation-free reserved and multicast ranges: never a viewer's address. */
export function isPrivateOrReserved(ip: string): boolean {
  const v4 = ipv4Parts(ip.startsWith('::ffff:') ? ip.slice(7) : ip);
  if (v4) {
    const [a, b] = v4;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && v4[2] === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (isIP(ip) === 6) {
    const s = ip.toLowerCase();
    return (
      s === '::' ||
      s === '::1' ||
      s.startsWith('fc') ||
      s.startsWith('fd') ||
      /^fe[89ab]/.test(s) ||
      s.startsWith('ff')
    );
  }
  return true;
}

/** The function URL's peer (the CloudFront edge) from the Lambda Web Adapter's request-context header, if present. */
function socketFromRequestContext(get: HeaderGet): string | null {
  const raw = get('x-amzn-request-context');
  if (!raw) return null;
  try {
    const ctx = JSON.parse(raw) as { http?: { sourceIp?: string }; identity?: { sourceIp?: string } };
    const ip = (ctx.http?.sourceIp ?? ctx.identity?.sourceIp ?? '').trim();
    return isIP(ip) ? ip : null;
  } catch {
    return null;
  }
}

/** Resolve the client IP and how far it can be trusted. See ClientIpSource. */
export function resolveClientIp(get: HeaderGet): ClientIp {
  const viewer = stripPort(get('cloudfront-viewer-address'), true);
  if (viewer) return { ip: truncateIp(viewer), source: 'viewer' };

  const socket = socketFromRequestContext(get);
  const hops = (get('x-forwarded-for') ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);

  if (hops.length) {
    if (socket) {
      for (let i = hops.length - 1; i >= 0; i--) {
        const hop = stripPort(hops[i]) ?? hops[i];
        if (!isIP(hop) || hop === socket || isPrivateOrReserved(hop)) continue;
        return { ip: truncateIp(hop), source: 'xff_right' };
      }
    }
    // we cannot tell which hops our proxies added: keep today's first-hop answer, marked as unverified
    return { ip: truncateIp(stripPort(hops[0]) ?? hops[0]), source: 'xff_first' };
  }

  const peer = get('x-real-ip')?.trim() || get('cf-connecting-ip')?.trim() || socket;
  return peer ? { ip: truncateIp(peer), source: 'socket' } : { ip: null, source: null };
}

/** Client IP with its source, from a Fetch API request. */
export function getClientIpWithSource(request: Request | null | undefined): ClientIp {
  if (!request) return { ip: null, source: null };
  return resolveClientIp((n) => request.headers.get(n));
}

/** Best-effort client IP (see resolveClientIp for the order). */
export function getClientIp(request: Request): string | null {
  return getClientIpWithSource(request).ip;
}
