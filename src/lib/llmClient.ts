// LLM client using LangChain with env-based configuration (backend only)
import { ChatOpenAI } from '@langchain/openai';

export function createLLMClient(options: Record<string, unknown> = {}): ChatOpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const config: Record<string, unknown> = {
    apiKey,
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    ...options,
  };

  if (process.env.OPENAI_BASE_URL) {
    (config as { configuration?: { baseURL: string } }).configuration = {
      baseURL: process.env.OPENAI_BASE_URL,
    };
  }

  return new ChatOpenAI(config as ConstructorParameters<typeof ChatOpenAI>[0]);
}

let _llmClient: ChatOpenAI | null = null;

export function getLLMClient(): ChatOpenAI {
  if (!_llmClient) {
    _llmClient = createLLMClient();
  }
  return _llmClient;
}


export function createJSONLLMClient(temperature = 0.4): ChatOpenAI {
  return createLLMClient({
    temperature,
    response_format: { type: 'json_object' },
  });
}
