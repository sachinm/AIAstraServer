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
