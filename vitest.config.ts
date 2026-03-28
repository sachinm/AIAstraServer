import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@google/generative-ai': path.resolve(__dirname, 'tests/mocks/google-generative-ai.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    server: {
      deps: {
        inline: ['@langchain/google-genai'],
      },
    },
    env: {
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
      OPENAI_API_KEY: 'test-openai-key-not-used-in-tests',
    },
    setupFiles: ['tests/setup.ts'],
  },
});
