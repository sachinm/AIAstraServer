/**
 * Gemini explicit context cache (cachedContents) + DynamoDB pointers.
 * Cache: systemInstruction + Kundli chart context. Chat turns send only the question (+ history later).
 * Refresh on login/signup and when Kundli sync completes / TTL expires. Users never edit birth data.
 */
import { createHash } from 'node:crypto';
import {
  DynamoDBClient,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import type { PrismaClient } from '@prisma/client';
import { Agent, fetch as undiciFetch } from 'undici';
import { loadSystemPrompt } from './kundliService.js';
import { fetchLatestKundliForUser } from '../../kundli-rag.js';
import { buildUserMessageWithKundli } from './groqChatService.js';
import {
  getChatLlmProvider,
  getChatKundliContextMode,
  getGeminiCacheTableName,
  getGeminiCacheTtlSeconds,
  getGeminiChatModelId,
  getGeminiCachedContentsApiBase,
  getGeminiUndiciBodyTimeoutMs,
  getGeminiUndiciHeadersTimeoutMs,
} from '../config/env.js';

const GEMINI_CHAT_SYSTEM_PROMPT_NAME = 'pvr_oracle';

/** Same appendix as geminiChatService — must match what is cached. */
export const GEMINI_CONCISE_ANSWER_APPENDIX =
  'Prefer concise answers: lead with a brief direct reply, keep chart analysis focused, and avoid unnecessary length.';

/** Model turn required by Gemini multi-turn cache contents after user Kundli blobs. */
const CACHE_MODEL_ACK =
  'Understood. I have the natal chart context and will use it for subsequent questions.';

let ddb: DynamoDBClient | undefined;
let undiciAgent: Agent | undefined;

function getDdb(): DynamoDBClient {
  if (!ddb) {
    ddb = new DynamoDBClient({
      region: process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim() || 'us-east-1',
    });
  }
  return ddb;
}

function getAgent(): Agent {
  if (!undiciAgent) {
    undiciAgent = new Agent({
      headersTimeout: getGeminiUndiciHeadersTimeoutMs(),
      bodyTimeout: getGeminiUndiciBodyTimeoutMs(),
    });
  }
  return undiciAgent;
}

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY is required when CHAT_LLM_PROVIDER=gemini');
  return key;
}

export function isGeminiCacheEnabled(): boolean {
  if (getChatLlmProvider() !== 'gemini') return false;
  if (process.env.GEMINI_CACHE_ENABLED?.trim() === '0') return false;
  return Boolean(getGeminiCacheTableName());
}

export interface GeminiCachePointer {
  cacheName: string;
  expiresAt: number;
  kundliVersion: string;
  payloadHash: string;
}

export interface StableGeminiCachePayload {
  systemPrompt: string;
  kundliUserContents: string[];
  payloadHash: string;
  kundliVersion: string;
}

function hashPayload(parts: string[]): string {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  h.update('|');
  h.update(getChatKundliContextMode());
  h.update('|');
  h.update(getGeminiChatModelId());
  return h.digest('hex');
}

export async function buildStableGeminiCachePayload(
  prisma: PrismaClient,
  userId: string
): Promise<StableGeminiCachePayload | null> {
  const systemPromptBase = await loadSystemPrompt(prisma, GEMINI_CHAT_SYSTEM_PROMPT_NAME);
  const systemPrompt = `${String(systemPromptBase ?? '').trimEnd()}\n\n${GEMINI_CONCISE_ANSWER_APPENDIX}`;

  let kundliRow;
  try {
    kundliRow = await fetchLatestKundliForUser(prisma, userId);
  } catch {
    return null;
  }

  const { kundliUserContents } = buildUserMessageWithKundli(
    {
      biodata: kundliRow.biodata,
      d1: kundliRow.d1,
      d2: kundliRow.d2,
      d4: kundliRow.d4,
      d7: kundliRow.d7,
      d9: kundliRow.d9,
      d10: kundliRow.d10,
      charakaraka: kundliRow.charakaraka,
      vimsottari_dasa: kundliRow.vimsottari_dasa,
      narayana_dasa: kundliRow.narayana_dasa,
    },
    ''
  );

  const kundliVersion =
    String((kundliRow as { id?: string }).id ?? '') ||
    String((kundliRow as { updated_at?: Date | string }).updated_at ?? '') ||
    'unknown';

  const payloadHash = hashPayload([systemPrompt, ...kundliUserContents, kundliVersion]);
  return { systemPrompt, kundliUserContents, payloadHash, kundliVersion };
}

export async function getGeminiCachePointer(userId: string): Promise<GeminiCachePointer | null> {
  const table = getGeminiCacheTableName();
  if (!table) return null;
  try {
    const out = await getDdb().send(
      new GetItemCommand({
        TableName: table,
        Key: { userId: { S: userId } },
      })
    );
    const item = out.Item;
    if (!item?.cacheName?.S) return null;
    const expiresAt = Number(item.expiresAt?.N ?? 0);
    return {
      cacheName: item.cacheName.S,
      expiresAt,
      kundliVersion: item.kundliVersion?.S ?? '',
      payloadHash: item.payloadHash?.S ?? '',
    };
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: 'geminiCache getItem failed',
        error: (err as Error).message,
      })
    );
    return null;
  }
}

async function putGeminiCachePointer(userId: string, pointer: GeminiCachePointer): Promise<void> {
  const table = getGeminiCacheTableName();
  if (!table) return;
  await getDdb().send(
    new PutItemCommand({
      TableName: table,
      Item: {
        userId: { S: userId },
        cacheName: { S: pointer.cacheName },
        expiresAt: { N: String(pointer.expiresAt) },
        kundliVersion: { S: pointer.kundliVersion },
        payloadHash: { S: pointer.payloadHash },
        kundliUpdatedAt: { S: new Date().toISOString() },
      },
    })
  );
}

async function deleteGeminiCachePointer(userId: string): Promise<void> {
  const table = getGeminiCacheTableName();
  if (!table) return;
  try {
    await getDdb().send(
      new DeleteItemCommand({
        TableName: table,
        Key: { userId: { S: userId } },
      })
    );
  } catch {
    /* best-effort */
  }
}

async function deleteRemoteCachedContent(cacheName: string): Promise<void> {
  try {
    const apiKey = getGeminiApiKey();
    const base = getGeminiCachedContentsApiBase();
    const url = `${base}/${cacheName}?key=${encodeURIComponent(apiKey)}`;
    await undiciFetch(url, { method: 'DELETE', dispatcher: getAgent() });
  } catch {
    /* best-effort */
  }
}

interface CachedContentsCreateResponse {
  name?: string;
  expireTime?: string;
  error?: { message?: string };
}

async function createRemoteCachedContent(
  payload: StableGeminiCachePayload
): Promise<{ name: string; expireTimeMs: number }> {
  const apiKey = getGeminiApiKey();
  const modelId = getGeminiChatModelId();
  const ttlSec = getGeminiCacheTtlSeconds();
  const url = `${getGeminiCachedContentsApiBase()}/cachedContents?key=${encodeURIComponent(apiKey)}`;

  const body = {
    model: `models/${modelId}`,
    displayName: `aiastra-${payload.payloadHash.slice(0, 16)}`,
    systemInstruction: {
      parts: [{ text: payload.systemPrompt }],
    },
    contents: [
      ...payload.kundliUserContents.map((text) => ({
        role: 'user' as const,
        parts: [{ text }],
      })),
      {
        role: 'model' as const,
        parts: [{ text: CACHE_MODEL_ACK }],
      },
    ],
    ttl: `${ttlSec}s`,
  };

  const res = await undiciFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    dispatcher: getAgent(),
  });
  const text = await res.text();
  let parsed: CachedContentsCreateResponse = {};
  try {
    parsed = text ? (JSON.parse(text) as CachedContentsCreateResponse) : {};
  } catch {
    /* plain text */
  }
  if (!res.ok || !parsed.name) {
    const msg = parsed.error?.message || (text && text.length < 1500 ? text : null) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  const expireTimeMs = parsed.expireTime
    ? Date.parse(parsed.expireTime)
    : Date.now() + ttlSec * 1000;
  return { name: parsed.name, expireTimeMs };
}

/**
 * Create or refresh Gemini cachedContents + DDB pointer for a user.
 * Safe to call fire-and-forget from login / Kundli complete.
 */
export async function ensureGeminiCacheForUser(
  prisma: PrismaClient,
  userId: string
): Promise<{ status: 'hit' | 'created' | 'skipped' | 'error'; cacheName?: string }> {
  if (!isGeminiCacheEnabled()) return { status: 'skipped' };

  try {
    const payload = await buildStableGeminiCachePayload(prisma, userId);
    if (!payload || payload.kundliUserContents.length === 0) {
      return { status: 'skipped' };
    }

    const existing = await getGeminiCachePointer(userId);
    const now = Date.now();
    const skewMs = 5 * 60 * 1000;
    if (
      existing &&
      existing.payloadHash === payload.payloadHash &&
      existing.expiresAt > now + skewMs &&
      existing.cacheName
    ) {
      return { status: 'hit', cacheName: existing.cacheName };
    }

    if (existing?.cacheName) {
      await deleteRemoteCachedContent(existing.cacheName);
      await deleteGeminiCachePointer(userId);
    }

    const created = await createRemoteCachedContent(payload);
    await putGeminiCachePointer(userId, {
      cacheName: created.name,
      expiresAt: created.expireTimeMs,
      kundliVersion: payload.kundliVersion,
      payloadHash: payload.payloadHash,
    });

    console.log(
      JSON.stringify({
        msg: 'geminiCache created',
        userIdPrefix: userId.slice(0, 8),
        ttlSec: getGeminiCacheTtlSeconds(),
        kundliContext: getChatKundliContextMode(),
      })
    );
    return { status: 'created', cacheName: created.name };
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: 'geminiCache ensure failed',
        error: (err as Error).message,
      })
    );
    return { status: 'error' };
  }
}

/**
 * Resolve a still-valid cache name for chat, matching current Kundli/system hash.
 */
export async function resolveGeminiCacheNameForChat(
  prisma: PrismaClient,
  userId: string
): Promise<string | null> {
  if (!isGeminiCacheEnabled()) return null;
  const payload = await buildStableGeminiCachePayload(prisma, userId);
  if (!payload) return null;
  const existing = await getGeminiCachePointer(userId);
  const now = Date.now();
  const skewMs = 5 * 60 * 1000;
  if (
    existing &&
    existing.payloadHash === payload.payloadHash &&
    existing.expiresAt > now + skewMs &&
    existing.cacheName
  ) {
    return existing.cacheName;
  }
  return null;
}
