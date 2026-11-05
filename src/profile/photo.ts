/**
 * The selfie (docs/reading-engine/52 §4). The device enables capture only while one face is in frame; the server then
 * guards against abuse: JPEG only, at most 150 KB, 256–1024 px square-ish, decoded and re-encoded with sharp (strips
 * metadata, refuses anything that is not an image), at most 5 captures an hour and 20 a day, a perceptual hash kept for
 * the admin module to spot one image used by many accounts, the previous photo kept 30 days. Bytes are served only to
 * the person themself.
 */
import type { PrismaClient } from '@prisma/client';

export const PHOTO_MAX_BYTES = 150 * 1024;
export const PHOTO_LIMIT_HOUR = 5;
export const PHOTO_LIMIT_DAY = 20;

export type PhotoResult =
  | { status: 'ok'; width: number; height: number }
  | { status: 'too_big' | 'not_jpeg' | 'bad_image' | 'bad_size' | 'no_face' | 'rate_limited' };

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

/** The device's face box (x, y, w, h as fractions of the frame, score 0–1): one face, large and central enough. */
export function checkFaceBox(raw: unknown): FaceBox | null {
  if (typeof raw !== 'string') return null;
  let b: FaceBox;
  try {
    b = JSON.parse(raw) as FaceBox;
  } catch {
    return null;
  }
  const n = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
  if (![b.x, b.y, b.w, b.h, b.score].every(n)) return null;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (b.w < 0.25 || b.score < 0.7 || cx < 0.2 || cx > 0.8 || cy < 0.2 || cy > 0.8) return null;
  return b;
}

/** A 64-bit average hash of an 8×8 greyscale thumbnail, as 16 hex characters. */
export function averageHash(pixels: Uint8Array): string {
  const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
  let bits = '';
  for (const p of pixels) bits += p >= mean ? '1' : '0';
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export type SharpFn = (input: Buffer) => {
  metadata(): Promise<{ format?: string; width?: number; height?: number }>;
  rotate(): ReturnType<SharpFn>;
  resize(w: number, h: number, o?: object): ReturnType<SharpFn>;
  greyscale(): ReturnType<SharpFn>;
  jpeg(o?: object): ReturnType<SharpFn>;
  raw(): ReturnType<SharpFn>;
  toBuffer(): Promise<Buffer>;
};

async function loadSharp(): Promise<SharpFn> {
  const mod = (await import('sharp')) as unknown as { default: SharpFn };
  return mod.default;
}

export async function savePhoto(prisma: PrismaClient, userId: string, body: Buffer, faceHeader: unknown, deps: { sharp?: SharpFn; now?: Date } = {}): Promise<PhotoResult> {
  const now = deps.now ?? new Date();
  const hourAgo = new Date(now.getTime() - 3600_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const [lastHour, lastDay] = await Promise.all([
    prisma.profilePhotoAttempt.count({ where: { user_id: userId, at: { gte: hourAgo } } }),
    prisma.profilePhotoAttempt.count({ where: { user_id: userId, at: { gte: dayAgo } } }),
  ]);
  if (lastHour >= PHOTO_LIMIT_HOUR || lastDay >= PHOTO_LIMIT_DAY) return { status: 'rate_limited' };
  const attempt = async (outcome: string) => prisma.profilePhotoAttempt.create({ data: { user_id: userId, outcome, at: now } });

  if (body.length > PHOTO_MAX_BYTES) {
    await attempt('too_big');
    return { status: 'too_big' };
  }
  if (body.length < 4 || body[0] !== 0xff || body[1] !== 0xd8) {
    await attempt('not_jpeg');
    return { status: 'not_jpeg' };
  }
  const face = checkFaceBox(faceHeader);
  if (!face) {
    await attempt('no_face');
    return { status: 'no_face' };
  }
  const sharp = deps.sharp ?? (await loadSharp());
  let meta: { format?: string; width?: number; height?: number };
  try {
    meta = await sharp(body).metadata();
  } catch {
    await attempt('bad_image');
    return { status: 'bad_image' };
  }
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (meta.format !== 'jpeg' || w < 256 || h < 256 || w > 1024 || h > 1024 || Math.abs(w - h) > w * 0.1) {
    await attempt('bad_size');
    return { status: 'bad_size' };
  }
  const clean = await sharp(body).rotate().resize(512, 512, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
  const thumb = await sharp(clean).greyscale().resize(8, 8, { fit: 'fill' }).raw().toBuffer();
  const phash = averageHash(new Uint8Array(thumb));
  const bytes = new Uint8Array(clean);
  const existing = await prisma.profilePhoto.findUnique({ where: { user_id: userId }, select: { bytes: true } });
  await prisma.profilePhoto.upsert({
    where: { user_id: userId },
    create: { user_id: userId, bytes, mime: 'image/jpeg', width: 512, height: 512, face_box: face as unknown as object, phash, created_at: now },
    update: { bytes, mime: 'image/jpeg', width: 512, height: 512, face_box: face as unknown as object, phash, created_at: now, prev_bytes: existing?.bytes ?? null, replaced_at: existing ? now : null },
  });
  await attempt('ok');
  await prisma.personFact.upsert({
    where: { user_id_key: { user_id: userId, key: 'wizard.selfie' } },
    create: { user_id: userId, key: 'wizard.selfie', value: 'done', source: 'tapped', confirmed_at: now },
    update: { value: 'done', confirmed_at: now, updated_at: now },
  });
  return { status: 'ok', width: 512, height: 512 };
}

export async function readPhoto(prisma: PrismaClient, userId: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const p = await prisma.profilePhoto.findUnique({ where: { user_id: userId }, select: { bytes: true, mime: true } });
  return p ? { bytes: Buffer.from(p.bytes), mime: p.mime } : null;
}

/** Remove the photo; with `restore`, put back the previous one if it is under 30 days old. */
export async function removePhoto(prisma: PrismaClient, userId: string, restore = false, now = new Date()): Promise<boolean> {
  const p = await prisma.profilePhoto.findUnique({ where: { user_id: userId }, select: { prev_bytes: true, replaced_at: true } });
  if (!p) return false;
  if (restore && p.prev_bytes && p.replaced_at && now.getTime() - p.replaced_at.getTime() < 30 * 86_400_000) {
    await prisma.profilePhoto.update({ where: { user_id: userId }, data: { bytes: p.prev_bytes, prev_bytes: null, replaced_at: null } });
    return true;
  }
  await prisma.profilePhoto.delete({ where: { user_id: userId } });
  return true;
}
