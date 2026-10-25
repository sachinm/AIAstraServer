/**
 * Offline estimate of what the legacy chat path sends to the model for the golden chart: it builds the real user messages
 * with the real formatter (`buildUserMessageWithKundli`) from the legacy export fixtures, in lean and full mode, and counts
 * characters / 3.6 like the pack estimator so the comparison is like for like. The DB `pvr_oracle` system prompt is not
 * available offline; the markdown appendix and concise-answer appendix are the known lower bound of the legacy system prompt.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PVR_ORACLE_MARKDOWN_FORMAT_APPENDIX } from '../src/config/chatOracleMarkdownAppendix.js';
import { buildUserMessageWithKundli } from '../src/services/groqChatService.js';
import { PROMPTS } from '../src/reading/prompts/generated.js';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(path.resolve(process.cwd(), 'evals/fixtures/G1/legacy', `${name}.json`), 'utf8'));
}

export function legacyTokenEstimate(): { leanTokens: number; fullTokens: number; methodTokens: number; note: string } {
  const kundli = {
    biodata: fixture('biodata'), d1: fixture('d1'), d2: fixture('d2'), d4: fixture('d4'), d7: fixture('d7'), d9: fixture('d9'), d10: fixture('d10'),
    charakaraka: fixture('charakaraka'), vimsottari_dasa: fixture('vimsottari_dasa'), narayana_dasa: fixture('narayana_dasa'),
  };
  const prior = process.env.CHAT_KUNDLI_CONTEXT;
  const size = (mode: 'lean' | 'full'): number => {
    process.env.CHAT_KUNDLI_CONTEXT = mode;
    const { kundliUserContents } = buildUserMessageWithKundli(kundli, 'question');
    return Math.ceil((kundliUserContents.reduce((n, s) => n + s.length, 0) + PVR_ORACLE_MARKDOWN_FORMAT_APPENDIX.length) / 3.6);
  };
  const lean = size('lean');
  const full = size('full');
  if (prior === undefined) delete process.env.CHAT_KUNDLI_CONTEXT;
  else process.env.CHAT_KUNDLI_CONTEXT = prior;
  const method = Math.ceil((PROMPTS['persona']!.length + PROMPTS['method']!.length) / 3.6);
  return {
    leanTokens: lean,
    fullTokens: full,
    methodTokens: method,
    note: 'chars/3.6 estimate; legacy system prompt (DB pvr_oracle) excluded except the markdown appendix, so the true legacy figure is higher',
  };
}
