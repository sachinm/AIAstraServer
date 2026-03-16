import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../../src/lib/hash.js';

describe('hash', () => {
  it('hashes and compares password', async () => {
    const plain = 'mypassword123';
    const hashed = await hashPassword(plain);
    expect(hashed).toBeDefined();
    expect(hashed).not.toBe(plain);
    const ok = await comparePassword(plain, hashed);
    expect(ok).toBe(true);
    const bad = await comparePassword('wrong', hashed);
    expect(bad).toBe(false);
  });
});
