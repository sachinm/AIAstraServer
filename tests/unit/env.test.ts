import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('config/env', () => {
  const origEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  describe('getNodeEnv', () => {
    it('returns development when NODE_ENV is unset', async () => {
      delete process.env.NODE_ENV;
      const { getNodeEnv } = await import('../../src/config/env.js');
      expect(getNodeEnv()).toBe('development');
    });

    it('returns local when NODE_ENV is local', async () => {
      process.env.NODE_ENV = 'local';
      const { getNodeEnv } = await import('../../src/config/env.js');
      expect(getNodeEnv()).toBe('local');
    });

    it('returns development when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development';
      const { getNodeEnv } = await import('../../src/config/env.js');
      expect(getNodeEnv()).toBe('development');
    });

    it('returns staging when NODE_ENV is staging', async () => {
      process.env.NODE_ENV = 'staging';
      const { getNodeEnv } = await import('../../src/config/env.js');
      expect(getNodeEnv()).toBe('staging');
    });

    it('returns production when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';
      const { getNodeEnv } = await import('../../src/config/env.js');
      expect(getNodeEnv()).toBe('production');
    });

    it('returns development when NODE_ENV is invalid', async () => {
      process.env.NODE_ENV = 'invalid';
      const { getNodeEnv } = await import('../../src/config/env.js');
      expect(getNodeEnv()).toBe('development');
    });
  });

  describe('getAstroKundliBaseUrl', () => {
    it('returns ASTROKUNDLI_BASE_URL_LOCAL when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ASTROKUNDLI_BASE_URL_LOCAL = 'http://localhost:8765';
      const { getAstroKundliBaseUrl } = await import('../../src/config/env.js');
      expect(getAstroKundliBaseUrl()).toBe('http://localhost:8765');
    });

    it('returns ASTROKUNDLI_BASE_URL_STAGING when NODE_ENV is staging', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.ASTROKUNDLI_BASE_URL_STAGING = 'http://localhost:8766';
      const { getAstroKundliBaseUrl } = await import('../../src/config/env.js');
      expect(getAstroKundliBaseUrl()).toBe('http://localhost:8766');
    });

    it('returns ASTROKUNDLI_BASE_URL_PROD when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ASTROKUNDLI_BASE_URL_PROD = 'http://localhost:8767';
      const { getAstroKundliBaseUrl } = await import('../../src/config/env.js');
      expect(getAstroKundliBaseUrl()).toBe('http://localhost:8767');
    });

    it('throws when ASTROKUNDLI_BASE_URL_LOCAL is missing in development', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ASTROKUNDLI_BASE_URL_LOCAL;
      const { getAstroKundliBaseUrl } = await import('../../src/config/env.js');
      expect(() => getAstroKundliBaseUrl()).toThrow(/ASTROKUNDLI_BASE_URL_LOCAL/);
    });
  });

  describe('isDevOrLocal', () => {
    it('returns true when NODE_ENV is local', async () => {
      process.env.NODE_ENV = 'local';
      const { isDevOrLocal } = await import('../../src/config/env.js');
      expect(isDevOrLocal()).toBe(true);
    });

    it('returns true when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development';
      const { isDevOrLocal } = await import('../../src/config/env.js');
      expect(isDevOrLocal()).toBe(true);
    });

    it('returns false when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';
      const { isDevOrLocal } = await import('../../src/config/env.js');
      expect(isDevOrLocal()).toBe(false);
    });

    it('returns false when NODE_ENV is staging', async () => {
      process.env.NODE_ENV = 'staging';
      const { isDevOrLocal } = await import('../../src/config/env.js');
      expect(isDevOrLocal()).toBe(false);
    });
  });

  describe('isAstroKundliConfigured', () => {
    it('returns true when base URL is set for current env', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ASTROKUNDLI_BASE_URL_LOCAL = 'http://localhost:8765';
      const { isAstroKundliConfigured } = await import('../../src/config/env.js');
      expect(isAstroKundliConfigured()).toBe(true);
    });

    it('returns false when base URL is empty for current env', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ASTROKUNDLI_BASE_URL_LOCAL = '';
      const { isAstroKundliConfigured } = await import('../../src/config/env.js');
      expect(isAstroKundliConfigured()).toBe(false);
    });
  });
});
