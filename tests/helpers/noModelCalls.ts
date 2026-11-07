import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { afterEach, beforeEach, expect, vi } from 'vitest';

const spyFetch = () => vi.spyOn(globalThis, 'fetch');
const spyBedrock = () => vi.spyOn(BedrockRuntimeClient.prototype, 'send');

/**
 * Spies on the two ways a model is reached, around every test of the file, and fails the test if either was used: the
 * Gemini REST client goes out through `fetch`, the Bedrock client through `BedrockRuntimeClient.send`. Proves that no
 * model (and so no paid) call was made.
 */
export function guardNoModelCalls(): void {
  let fetchSpy: ReturnType<typeof spyFetch> | undefined;
  let bedrockSpy: ReturnType<typeof spyBedrock> | undefined;
  beforeEach(() => {
    fetchSpy = spyFetch();
    bedrockSpy = spyBedrock();
  });
  afterEach(() => {
    expect(fetchSpy!).not.toHaveBeenCalled();
    expect(bedrockSpy!).not.toHaveBeenCalled();
    fetchSpy!.mockRestore();
    bedrockSpy!.mockRestore();
  });
}
