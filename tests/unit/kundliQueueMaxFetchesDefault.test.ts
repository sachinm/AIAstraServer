import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getKundliQueueMaxFetchesPerUser } from '../../src/config/env.js';

describe('KUNDLI_QUEUE_MAX_FETCHES_PER_USER (S-6)', () => {
  const original = process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER;

  beforeEach(() => {
    delete process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER;
    else process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER = original;
  });

  it('defaults to 3 when the env var is unset', () => {
    expect(getKundliQueueMaxFetchesPerUser()).toBe(3);
  });

  it('uses the env var when it is set to a valid integer', () => {
    process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER = '1';
    expect(getKundliQueueMaxFetchesPerUser()).toBe(1);
    process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER = '4';
    expect(getKundliQueueMaxFetchesPerUser()).toBe(4);
  });

  it('falls back to the default for out-of-range values', () => {
    process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER = '0';
    expect(getKundliQueueMaxFetchesPerUser()).toBe(3);
    process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER = '17';
    expect(getKundliQueueMaxFetchesPerUser()).toBe(3);
  });
});
