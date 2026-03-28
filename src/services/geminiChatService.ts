/**
 * Gemini chat via LangGraph + @langchain/google-genai (streamGenerateContent under the hood).
 * Streams answer tokens and optional Gemini 2.5 “thinking” parts for SSE clients.
 */
import type { PrismaClient } from '@prisma/client';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, isAIMessage, isAIMessageChunk } from '@langchain/core/messages';
import type { AIMessage, AIMessageChunk, BaseMessage, BaseMessageChunk } from '@langchain/core/messages';
import { END, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph';
import { loadSystemPrompt } from './kundliService.js';
import { fetchLatestKundliForUser } from '../../kundli-rag.js';
import { buildUserMessageWithKundli } from './groqChatService.js';
import type { ChatWithGroqResult } from './groqChatService.js';
import {
  getGeminiChatModelId,
  getGeminiGoogleGenAiClientOptions,
  getGeminiMaxOutputTokens,
  isGeminiIncludeThoughtsEnabled,
  getGeminiThinkingBudget,
} from '../config/env.js';

const GEMINI_CHAT_SYSTEM_PROMPT_NAME = 'pvr_oracle';

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY is required when CHAT_LLM_PROVIDER=gemini');
  return key;
}

/** Text + thought from streamed chunks or a final {@link AIMessage} (same content shapes). */
function extractTextAndThoughtFromAiMessageLike(msg: AIMessage | AIMessageChunk): { text: string; thought: string } {
  let text = '';
  let thought = '';
  const c = msg.content;
  if (typeof c === 'string' && c) {
    text = c;
  } else if (Array.isArray(c)) {
    for (const block of c) {
      if (!block || typeof block !== 'object') continue;
      const b = block as { type?: string; thinking?: string; text?: string };
      if (b.type === 'thinking' && typeof b.thinking === 'string') thought += b.thinking;
      else if (b.type === 'text' && typeof b.text === 'string') text += b.text;
    }
  }
  const fallbackText = typeof msg.text === 'string' ? msg.text : '';
  if (!text && fallbackText) text = fallbackText;
  return { text, thought };
}

function buildChatModel(): ChatGoogleGenerativeAI {
  const { baseUrl, apiVersion } = getGeminiGoogleGenAiClientOptions();
  const includeThoughts = isGeminiIncludeThoughtsEnabled();
  const thinkingBudget = getGeminiThinkingBudget();

  return new ChatGoogleGenerativeAI({
    model: getGeminiChatModelId(),
    apiKey: getGeminiApiKey(),
    baseUrl,
    apiVersion,
    temperature: 1,
    maxOutputTokens: getGeminiMaxOutputTokens(),
    topP: 1,
    streaming: true,
    ...(includeThoughts
      ? {
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget,
          },
        }
      : {}),
  });
}

function buildGeminiAgentGraph(model: ChatGoogleGenerativeAI) {
  return new StateGraph(MessagesAnnotation)
    .addNode('agent', async (state) => {
      const response = await model.invoke(state.messages);
      return { messages: [response] };
    })
    .addEdge(START, 'agent')
    .addEdge('agent', END)
    .compile();
}

/**
 * One chat turn: system prompt + Kundli-packaged messages, LangGraph agent node, stream
 * `streamMode: "messages"` for SSE deltas (answer + optional thinking).
 */
export async function chatWithGemini(
  prisma: PrismaClient,
  userId: string,
  userQuestion: string,
  options?: { onDelta?: (delta: string) => void; onThoughtDelta?: (delta: string) => void }
): Promise<ChatWithGroqResult> {
  const systemPrompt = await loadSystemPrompt(prisma, GEMINI_CHAT_SYSTEM_PROMPT_NAME);
  const kundliRow = await fetchLatestKundliForUser(prisma, userId);
  const { kundliUserContents, userQuestion: questionText } = buildUserMessageWithKundli(
    {
      biodata: kundliRow.biodata,
      d1: kundliRow.d1,
      d7: kundliRow.d7,
      d9: kundliRow.d9,
      d10: kundliRow.d10,
      charakaraka: kundliRow.charakaraka,
      vimsottari_dasa: kundliRow.vimsottari_dasa,
      narayana_dasa: kundliRow.narayana_dasa,
    },
    userQuestion
  );

  const messages = [
    new SystemMessage({ content: systemPrompt }),
    ...kundliUserContents.map((text) => new HumanMessage({ content: text })),
    new HumanMessage({ content: questionText }),
  ];

  const model = buildChatModel();
  const graph = buildGeminiAgentGraph(model);

  let answerText = '';
  let thinkingText = '';
  let lastUsage: Record<string, unknown> | null = null;

  const stream = await graph.stream({ messages }, { streamMode: 'messages' });
  for await (const item of stream) {
    const tuple = item as unknown as [unknown, unknown];
    const raw = (Array.isArray(tuple) ? tuple[0] : tuple) as unknown;

    if (isAIMessageChunk(raw as BaseMessageChunk)) {
      const msg = raw as AIMessageChunk;
      if (msg.usage_metadata && typeof msg.usage_metadata === 'object') {
        lastUsage = msg.usage_metadata as Record<string, unknown>;
      }
      const { text, thought } = extractTextAndThoughtFromAiMessageLike(msg);
      if (thought) {
        thinkingText += thought;
        options?.onThoughtDelta?.(thought);
      }
      if (text) {
        answerText += text;
        options?.onDelta?.(text);
      }
      continue;
    }

    /**
     * LangGraph also emits the node’s final {@link AIMessage} via `handleChainEnd` (not a chunk).
     * If token callbacks produced no visible text (common with some Gemini + thinking setups),
     * this is often the only place the full answer appears — we must not skip it.
     */
    if (isAIMessage(raw as BaseMessage)) {
      const msg = raw as AIMessage;
      if (msg.usage_metadata && typeof msg.usage_metadata === 'object') {
        lastUsage = msg.usage_metadata as Record<string, unknown>;
      }
      const { text, thought } = extractTextAndThoughtFromAiMessageLike(msg);
      if (thought) {
        thinkingText += thought;
        options?.onThoughtDelta?.(thought);
      }
      if (text && !answerText.trim()) {
        answerText = text;
        options?.onDelta?.(text);
      }
    }
  }

  const answerTextOut = answerText.trim() || 'No response generated.';
  const thinkingOut = thinkingText.trim();

  const requestPayload: Record<string, unknown> = {
    provider: 'gemini',
    transport: 'langgraph',
    graph: 'single_agent_messages',
    model: getGeminiChatModelId(),
    thinking: isGeminiIncludeThoughtsEnabled()
      ? { includeThoughts: true, thinkingBudget: getGeminiThinkingBudget() }
      : { disabled: true },
    message_count: messages.length,
    generation: {
      temperature: 1,
      maxOutputTokens: getGeminiMaxOutputTokens(),
      topP: 1,
    },
  };

  const responsePayload: Record<string, unknown> = {
    provider: 'gemini',
    streamed: true,
    langgraph_stream_mode: 'messages',
    content: answerTextOut,
    thinking: thinkingOut || undefined,
    finish_reason: null,
    usage: lastUsage,
  };

  return {
    answerText: answerTextOut,
    thinkingText: thinkingOut || undefined,
    requestPayload,
    responsePayload,
  };
}
