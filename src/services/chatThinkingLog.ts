/**
 * Structured logs for Gemini / model “thinking” streaming (ops).
 * Disable with `CHAT_THINKING_LOG=0`.
 */
import { isChatThinkingLogEnabled } from '../config/env.js';

export function logChatThinking(event: string, meta: Record<string, unknown>): void {
  if (!isChatThinkingLogEnabled()) return;
  console.info('[chat thinking]', event, meta);
}
