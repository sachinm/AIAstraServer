/**
 * No personal value reaches a log line (docs/privacy/02 B0.1). Each path that used to log a person's data runs with
 * sentinel values while every console method is captured; none of the sentinels may appear in what was written.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/env.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/config/env.js')>()),
  getAstroKundliBaseUrl: vi.fn(() => 'http://localhost:8765'),
  getAstroKundliTransport: vi.fn(() => 'http'),
  getAstroKundliApiKey: vi.fn(() => 'test-key'),
}));

import { fetchEngineExport, RadhaHttpError } from '../../src/lib/astroKundliClient.js';
import { graphqlLogFields, maskEmail, redactForLog } from '../../src/lib/logRedact.js';
import { queueLog, queueLogError } from '../../src/lib/queueLogger.js';
import { safeJSONParse } from '../../src/services/kundliService.js';
import { sendMagicLinkEmail } from '../../src/services/emailService.js';
import { logChatProviderError } from '../../src/services/publicChatError.js';

const SENTINEL = {
  email: 'zq.sentinel.person@example.com',
  name: 'Zebulon Quixote',
  dob: '1987-03-14',
  tob: '05:42:17',
  place: 'Zzyzxville,US',
  lat: 34.123456,
  lon: -116.104321,
  question: 'Will Zebulon marry Quillon in 2031?',
  chart: 'Ascendant Zygoterra 17deg',
};
const SENTINEL_STRINGS = [SENTINEL.email, SENTINEL.name, SENTINEL.dob, SENTINEL.tob, SENTINEL.place, String(SENTINEL.lat), String(SENTINEL.lon), SENTINEL.question, SENTINEL.chart];

let lines: string[] = [];
const logFile = path.join(os.tmpdir(), `aiastra-nopii-${process.pid}.log`);
const savedEnv: Record<string, string | undefined> = {};
const ENV_KEYS = ['KUNDLI_QUEUE_LOG_FILE', 'KUNDLI_QUEUE_LOG_CONSOLE', 'RESEND_API_KEY', 'SMTP_HOST', 'NODE_ENV', 'AWS_LAMBDA_FUNCTION_NAME'];

function captured(): string {
  const file = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  return lines.join('\n') + '\n' + file;
}

function expectNoSentinel(): void {
  const text = captured();
  for (const s of SENTINEL_STRINGS) expect(text, `log contains ${s}`).not.toContain(s);
}

beforeEach(() => {
  lines = [];
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.KUNDLI_QUEUE_LOG_FILE = logFile;
  process.env.KUNDLI_QUEUE_LOG_CONSOLE = '1';
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
});

describe('no personal data in logs', () => {
  it('GraphQL: the incoming line carries the operation name only, never the body', () => {
    const body = {
      operationName: 'SignUp',
      query: 'mutation SignUp($email: String!) { signUp(email: $email) { token } }',
      variables: { email: SENTINEL.email, name: SENTINEL.name, date_of_birth: SENTINEL.dob, time_of_birth: SENTINEL.tob, place_of_birth: SENTINEL.place, question: SENTINEL.question },
    };
    console.log('[GraphQL] incoming', { path: '/graphql', method: 'POST', ...graphqlLogFields(body) });
    expect(graphqlLogFields(body)).toEqual({ operationName: 'SignUp', hasVariables: true });
    expect(graphqlLogFields({ query: 'query Me { me { id } }' }).operationName).toBe('Me');
    expectNoSentinel();
  });

  it('server.ts no longer logs a GraphQL body snippet and has no debug route', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
    expect(src).not.toMatch(/bodySnippet/);
    expect(src).not.toMatch(/JSON\.stringify\(req\.body\)/);
    expect(src).not.toMatch(/['"`]\/debug\//);
  });

  it('chart build: the engine response and its errors are logged by size and status only', async () => {
    const chart = { data: { name: SENTINEL.name, dob: SENTINEL.dob, tob: SENTINEL.tob, place: SENTINEL.place, lat: SENTINEL.lat, lon: SENTINEL.lon, asc: SENTINEL.chart } };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(chart), { status: 200 })));
    const params = { dob: SENTINEL.dob, tob: SENTINEL.tob, place: SENTINEL.place, ayanamsa: 'LAHIRI' };
    await expect(fetchEngineExport(params, 'facts', { lat: SENTINEL.lat, lon: SENTINEL.lon })).resolves.toMatchObject({ asc: SENTINEL.chart });

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: `Could not resolve ${SENTINEL.place}`, detail: `${SENTINEL.place} at ${SENTINEL.lat}` }), { status: 422 })));
    await expect(fetchEngineExport(params, 'facts')).rejects.toBeInstanceOf(RadhaHttpError);
    // the build pipeline logs the thrown message through the queue log
    queueLogError({ event: 'chart_build', status: 'failed', error: `boom ${SENTINEL.email} ${SENTINEL.dob} ${SENTINEL.tob} ${SENTINEL.lat}` });
    expect(captured()).toContain('[AstroKundli] response');
    expect(captured()).toContain('HTTP 422');
    expectNoSentinel();
  });

  it('reading: unparseable model output is logged by length only', () => {
    expect(safeJSONParse(`{"answer": "${SENTINEL.question} ${SENTINEL.chart}"`, 'intent')).toBeNull();
    expect(captured()).toMatch(/rawLength/);
    expectNoSentinel();
  });

  it('reading: a provider error is logged redacted, without its message text', () => {
    const err = new Error(`400 bad request for prompt: ${SENTINEL.email} born ${SENTINEL.dob} ${SENTINEL.tob} at ${SENTINEL.lat},${SENTINEL.lon}`);
    logChatProviderError('ask-stream', err);
    expect(captured()).toContain('[chat-provider] ask-stream');
    expectNoSentinel();
  });

  it('sign-up: the local mail fallback masks the recipient', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    process.env.NODE_ENV = 'local';
    await sendMagicLinkEmail(SENTINEL.email, '123456');
    expect(captured()).toContain(maskEmail(SENTINEL.email));
    expectNoSentinel();
  });

  it('sign-up: on a Lambda the mail fallback never logs and refuses instead', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    process.env.NODE_ENV = 'local';
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'aiastra-server-api';
    await expect(sendMagicLinkEmail(SENTINEL.email, '123456')).rejects.toThrow(/Email not configured/);
    expect(captured()).not.toContain('123456');
    expectNoSentinel();
  });

  it('queue log: error text is redacted before it is written', () => {
    queueLog({ event: 'x', error: `${SENTINEL.email} ${SENTINEL.dob}T${SENTINEL.tob}Z ${SENTINEL.lon}` });
    expectNoSentinel();
  });
});

describe('redactForLog', () => {
  it('masks emails, dates, times, coordinates, tokens and cuts the text', () => {
    const out = redactForLog(`a@b.co 2001-02-03 12/31/1990 04:05 -73.98765 Bearer abc.def eyJhbGciOi.eyJzdWIi.sig 1234567`);
    expect(out).toBe('[email] [date] [date] [time] [num] Bearer [token] [token] [num]');
    expect(redactForLog('x'.repeat(500), 50)).toHaveLength(50);
  });
});
