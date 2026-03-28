/**
 * Vitest alias target for `@google/generative-ai` so LangChain’s client never hits the real API in unit tests.
 */
export const googleGenAiTestHarness = {
  generateContentStream: async (_request?: unknown, _requestOptions?: unknown) => ({
    stream: (async function* () {
      yield {
        candidates: [{ content: { parts: [{ text: 'Jupiter in the 5th ' }], role: 'model' } }],
      };
      yield {
        candidates: [
          {
            content: { parts: [{ text: 'favors learning.' }], role: 'model' },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: { totalTokenCount: 42 },
      };
    })(),
    response: Promise.resolve({}),
  }),
};

export class GoogleGenerativeAI {
  constructor(_apiKey: string) {
    void _apiKey;
  }

  getGenerativeModel() {
    return {
      generateContentStream: (request: unknown, requestOptions?: unknown) =>
        googleGenAiTestHarness.generateContentStream(request, requestOptions),
      systemInstruction: undefined,
      generationConfig: {},
    };
  }
}
