/**
 * server.ts is not loaded by any unit test, so a route module can be imported and never mounted (it happened on
 * 2026-11-05: Lucky times was imported but its register call was lost to a CRLF mismatch). This checks every route
 * module server.ts imports is also called.
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = fs.readFileSync('server.ts', 'utf8');

describe('server.ts mounts what it imports', () => {
  const registers = [...src.matchAll(/import \{[^}]*\b(register[A-Za-z]+Routes)\b[^}]*\} from/g)].map((m) => m[1]!);
  it('imports the expected route modules', () => {
    expect(registers).toEqual(expect.arrayContaining(['registerTimelineRoutes', 'registerLuckyRoutes', 'registerAreaRoutes']));
  });
  for (const r of registers) {
    it(`calls ${r}(app, ...)`, () => {
      expect(new RegExp(`\\b${r}\\(app,`).test(src)).toBe(true);
    });
  }
  it('seeds the agent registry at boot', () => {
    expect(/seedAgentRegistry\(prisma\)/.test(src)).toBe(true);
  });
});
