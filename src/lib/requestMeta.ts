/**
 * Best-effort client IP from incoming request (reverse proxies: X-Forwarded-For first hop).
 */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return truncateIp(first);
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return truncateIp(realIp);
  const cf = request.headers.get('cf-connecting-ip')?.trim();
  if (cf) return truncateIp(cf);
  return null;
}

function truncateIp(ip: string): string {
  return ip.length > 45 ? ip.slice(0, 45) : ip;
}

function truncate(value: string | null, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export type DeviceClass = 'mobile' | 'tablet' | 'desktop' | 'unknown';

export interface RequestAuditMeta {
  clientIp: string | null;
  userAgent: string | null;
  acceptLanguage: string | null;
  origin: string | null;
  countryCode: string | null;
  deviceClass: DeviceClass;
  browser: string | null;
  os: string | null;
  requestId: string | null;
}

/**
 * Collect HTTP / edge metadata for auth audit rows (works in normal and private browsing).
 */
export function collectRequestAuditMeta(
  request?: Request | null
): RequestAuditMeta {
  if (!request) {
    return {
      clientIp: null,
      userAgent: null,
      acceptLanguage: null,
      origin: null,
      countryCode: null,
      deviceClass: 'unknown',
      browser: null,
      os: null,
      requestId: null,
    };
  }

  const userAgent = truncate(request.headers.get('user-agent'), 512);
  const secChMobile = request.headers.get('sec-ch-ua-mobile');
  const secChPlatform = request.headers.get('sec-ch-ua-platform');

  return {
    clientIp: getClientIp(request),
    userAgent,
    acceptLanguage: truncate(request.headers.get('accept-language'), 128),
    origin: truncate(request.headers.get('origin'), 512),
    countryCode: truncate(request.headers.get('cf-ipcountry'), 8),
    deviceClass: inferDeviceClass(userAgent, secChMobile),
    browser: inferBrowser(userAgent, request.headers.get('sec-ch-ua')),
    os: inferOs(userAgent, secChPlatform),
    requestId: truncate(
      request.headers.get('x-request-id') ??
        request.headers.get('x-correlation-id'),
      128
    ),
  };
}

function inferDeviceClass(
  userAgent: string | null,
  secChMobile: string | null
): DeviceClass {
  if (secChMobile === '?1') return 'mobile';
  if (secChMobile === '?0') return 'desktop';
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|playbook/.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(ua)) {
    return 'mobile';
  }
  if (/android/.test(ua)) return 'tablet';
  if (/mozilla|chrome|safari|firefox|edg\//.test(ua)) return 'desktop';
  return 'unknown';
}

function inferBrowser(
  userAgent: string | null,
  secChUa: string | null
): string | null {
  if (secChUa) {
    const match = secChUa.match(/"([^";]+)"/);
    if (match?.[1] && !/^not /i.test(match[1])) return truncate(match[1], 64);
  }
  if (!userAgent) return null;
  const ua = userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
  if (/CriOS\//.test(ua)) return 'Chrome';
  if (/FxiOS\//.test(ua) || /Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  return truncate(ua.split(/[\s/]/)[0] ?? null, 64);
}

function inferOs(
  userAgent: string | null,
  secChPlatform: string | null
): string | null {
  if (secChPlatform) {
    const cleaned = secChPlatform.replace(/^"|"$/g, '').trim();
    if (cleaned) return truncate(cleaned, 64);
  }
  if (!userAgent) return null;
  const ua = userAgent;
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  return null;
}

const SENSITIVE_VARIABLE_KEYS = new Set([
  'password',
  'code',
  'turnstiletoken',
  'recaptchatoken',
]);

/**
 * Redact secrets from GraphQL request bodies before logging.
 */
export function redactGraphqlBodyForLog(body: unknown): string {
  try {
    if (body == null || typeof body !== 'object') {
      return JSON.stringify(body);
    }
    const clone = structuredClone(body) as Record<string, unknown>;
    if (clone.variables && typeof clone.variables === 'object') {
      clone.variables = redactSensitiveObject(
        clone.variables as Record<string, unknown>
      );
    }
    return JSON.stringify(clone);
  } catch {
    return '[unserializable body]';
  }
}

function redactSensitiveObject(
  value: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_VARIABLE_KEYS.has(lower)) {
      out[key] = '[REDACTED]';
      continue;
    }
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      out[key] = redactSensitiveObject(val as Record<string, unknown>);
      continue;
    }
    out[key] = val;
  }
  return out;
}
