import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
      OPENAI_API_KEY: 'test-openai-key-not-used-in-tests',
    },
    setupFiles: ['tests/setup.ts'],
  },
});
