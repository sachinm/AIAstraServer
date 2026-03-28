import crypto from 'crypto';
import cosineSimilarity from 'compute-cosine-similarity';
import {
  fetchLatestKundliForUser,
  kundliRowToChunks,
} from '../../kundli-rag.js';
import { createJSONLLMClient, getLLMClient } from '../lib/llmClient.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { PrismaClient } from '@prisma/client';
import { PVR_ORACLE_MARKDOWN_FORMAT_APPENDIX } from '../config/chatOracleMarkdownAppendix.js';

const TOP_K = 5;

export async function loadSystemPrompt(
  prisma: PrismaClient,
  name: string
): Promise<string> {
  const row = await prisma.systemPrompt.findFirst({
    where: { name, is_active: true },
    select: { prompt: true },
  });
  if (!row?.prompt) throw new Error('System prompt not found');
  const base = row.prompt.trimEnd();
  if (name === 'pvr_oracle') {
    return `${base}\n\n${PVR_ORACLE_MARKDOWN_FORMAT_APPENDIX}`;
  }
  return row.prompt;
}

function fakeEmbed(text: string): number[] {
  const hash = crypto.createHash('sha256').update(text).digest();
  return Array.from(hash)
    .slice(0, 256)
    .map((x) => x / 255);
}

/**
 * Run RAG query for a user: fetch latest kundli, chunk, embed, search, then LLM.
 * Returns { answer } or throws.
 */
export async function runRagQuery(
  prisma: PrismaClient,
  userId: string,
  question: string
): Promise<{ answer: string }> {
  const row = await fetchLatestKundliForUser(prisma, userId);
  const chunks = kundliRowToChunks(row);

  const vectorStore = chunks.map((chunk) => ({
    chunk,
    embedding: fakeEmbed(chunk),
  }));

  const queryEmbedding = fakeEmbed(question);
  const scored = vectorStore.map((item) => ({
    chunk: item.chunk,
    score: cosineSimilarity(queryEmbedding, item.embedding) ?? 0,
  }));
  const sorted = scored.sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, TOP_K);
  const weakRelevance = top.every((i) => (i.score ?? 0) < 0.7);
  const tailChunks = weakRelevance
    ? vectorStore.slice(-2).map((i) => i.chunk)
    : [];
  const contextChunks = [...top.map((i) => i.chunk), ...tailChunks];
  const context = contextChunks.join('\n');

  const systemPrompt = await loadSystemPrompt(prisma, 'qa');
  const userPrompt = `
The following chart data is the user's kundli as stored in the database.

--- BEGIN CHART DATA ---
${context}
--- END CHART DATA ---

User Question: ${question}
Please give a brief and accurate answer, only based on the above data.
`.trim();

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ];
  const response = await getLLMClient().invoke(messages);
  const content = response?.content;
  return {
    answer:
      typeof content === 'string' ? content : 'No answer generated.',
  };
}

function safeJSONParse(str: string, label = 'response'): unknown {
  try {
    return JSON.parse(str);
  } catch (err) {
    console.error(
      `❌ Failed to parse ${label}:`,
      (err as Error).message,
      '\nRaw:',
      str
    );
    return null;
  }
}

async function generateWithLLM({
  systemPrompt,
  userPrompt,
  label,
}: {
  systemPrompt: string;
  userPrompt: string;
  label: string;
}): Promise<unknown> {
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ];
  const jsonLLM = createJSONLLMClient(0.4);
  const response = await jsonLLM.invoke(messages);
  const raw = (response?.content as string) || '';
  return safeJSONParse(raw, label);
}

/**
 * Generate insights (remedies, mantras, routines) for the latest kundli and save to DB.
 */
export async function processKundliUpload(
  prisma: PrismaClient,
  userId: string
): Promise<{ remedies: unknown; mantras: unknown; routines: unknown }> {
  const kundliRow = await fetchLatestKundliForUser(prisma, userId);
  if (!kundliRow) throw new Error('No kundli found for this user');

  const kundliId = kundliRow.id;
  const chunks = kundliRowToChunks(kundliRow);
  const context = chunks.join('\n');

  const remediesPrompt = await loadSystemPrompt(prisma, 'remedies');
  const remediesJson = await generateWithLLM({
    systemPrompt: remediesPrompt,
    userPrompt: `Here is the user's kundli:\n${context}\nGenerate personalized remedies in JSON format.`,
    label: 'remedies',
  });

  const mantrasPrompt = await loadSystemPrompt(prisma, 'mantras');
  const mantrasJson = await generateWithLLM({
    systemPrompt: mantrasPrompt,
    userPrompt: `Here is the user's kundli:\n${context}\nGenerate personalized mantras in JSON format.`,
    label: 'mantras',
  });

  const routinePrompt = await loadSystemPrompt(prisma, 'routine');
  const routineJson = await generateWithLLM({
    systemPrompt: routinePrompt,
    userPrompt: `Here is the user's kundli:\n${context}\nGenerate daily & weekly routines in JSON format.`,
    label: 'routine',
  });

  await prisma.userGeneratedContent.create({
    data: {
      user_id: userId,
      kundli_id: kundliId,
      remedies: remediesJson ?? undefined,
      mantras: mantrasJson ?? undefined,
      routines: routineJson ?? undefined,
    },
  });

  return {
    remedies: remediesJson,
    mantras: mantrasJson,
    routines: routineJson,
  };
}
