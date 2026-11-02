/**
 * One voice call's conversation: what the agent does with each thing heard. Speech recognition and speech synthesis sit behind
 * interfaces, so this runs and is tested with no audio. Nothing routes to it yet: see docs/assistant/02 and 03.
 *
 * The rule that shapes it: nothing is spoken before it is checked. The whole answer comes back through answerQuestion's checks,
 * and only then goes to the voice.
 */
import { QUESTION_MAX_CHARS, type AssistantResult } from '../assistant/answer.js';
import { UNSURE } from '../assistant/guard.js';

export const GREETING = 'Hello, I can tell you what AI AdAstra can do. What would you like to know?';
export const SILENCE_LINE = "I'll let you go for now. Come back any time.";
export const CAP_LINE = "We've reached the end of our time for this call. To go further, sign up and let's look at your chart together.";

export const SILENCE_LIMIT_MS = 20_000;
export const CALL_LIMIT_MS = 180_000;

export type CallState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'ended';
export type EndReason = 'silence' | 'cap' | 'hangup';

/** Sends audio to the call. Must stop when the signal aborts. */
export interface TextToSpeech {
  speak(text: string, signal: AbortSignal): Promise<void>;
}

export interface TurnLogEntry {
  question: string;
  result: AssistantResult;
  /** the visitor spoke over it, so the answer was not heard in full */
  interrupted: boolean;
}

/** What goes to the page over the data channel. */
export type PageMessage =
  | { type: 'state'; state: CallState }
  | { type: 'caption'; who: 'visitor' | 'agent'; text: string; final: boolean }
  /** the voice failed: the page says these words in the device's own voice */
  | { type: 'say'; text: string }
  /** speech recognition failed: the page moves to its own */
  | { type: 'use_recognizer' }
  | { type: 'ended'; reason: EndReason };

export interface TurnDeps {
  answer(question: string): Promise<AssistantResult>;
  tts: TextToSpeech;
  send(message: PageMessage): void;
  log(entry: TurnLogEntry): Promise<void>;
  now?(): number;
}

export class VoiceTurns {
  private state: CallState = 'idle';
  private startedAt = 0;
  private lastHeardAt = 0;
  /** each new thing heard moves this on, and any older turn still running stops at its next step */
  private turnId = 0;
  private speaking: AbortController | null = null;
  private voiceFailed = false;

  constructor(private readonly d: TurnDeps) {}

  private now(): number {
    return this.d.now?.() ?? Date.now();
  }

  get currentState(): CallState {
    return this.state;
  }

  private setState(state: CallState): void {
    if (this.state === state) return;
    this.state = state;
    this.d.send({ type: 'state', state });
  }

  async start(): Promise<void> {
    this.startedAt = this.lastHeardAt = this.now();
    await this.say(GREETING, ++this.turnId);
    if (this.state !== 'ended') this.setState('listening');
  }

  /** The visitor started talking. Anything being said or worked out for them is dropped. */
  onSpeechStart(): void {
    if (this.state === 'ended') return;
    this.lastHeardAt = this.now();
    this.turnId++;
    this.speaking?.abort();
    this.speaking = null;
    this.setState('listening');
  }

  /** Words so far. A caption only: nothing is answered until the words are final. */
  onInterim(text: string): void {
    if (this.state === 'ended') return;
    this.lastHeardAt = this.now();
    this.d.send({ type: 'caption', who: 'visitor', text, final: false });
  }

  /** The recognizer's finished words: one turn. */
  async onFinal(text: string): Promise<void> {
    const question = text.trim().slice(0, QUESTION_MAX_CHARS);
    if (this.state === 'ended' || !question) return;
    this.lastHeardAt = this.now();
    const id = ++this.turnId;
    this.speaking?.abort();
    this.d.send({ type: 'caption', who: 'visitor', text: question, final: true });
    this.setState('thinking');

    let result: AssistantResult;
    try {
      result = await this.d.answer(question);
    } catch (err) {
      // answerQuestion does not throw, so this is a fault here. The person still hears something.
      console.warn(JSON.stringify({ msg: 'voice turn failed', error: (err as Error).message.slice(0, 200) }));
      if (id === this.turnId && this.state === 'thinking') {
        await this.say(UNSURE, id);
        if (id === this.turnId) this.setState('listening');
      }
      return;
    }

    const interruptedBeforeSpeech = id !== this.turnId;
    const spoke = interruptedBeforeSpeech ? false : await this.say(result.answer, id);
    await this.d.log({ question, result, interrupted: !spoke }).catch((err: Error) => {
      console.warn(JSON.stringify({ msg: 'voice log failed', error: err.message.slice(0, 200) }));
    });
    // finish() may have ended the call while this turn was speaking, which TypeScript cannot see
    if (id === this.turnId && (this.state as CallState) !== 'ended') this.setState('listening');
  }

  /** Says the words, or hands them to the page. False if the visitor spoke over them. */
  private async say(text: string, id: number): Promise<boolean> {
    this.d.send({ type: 'caption', who: 'agent', text, final: true });
    if (this.voiceFailed) {
      this.d.send({ type: 'say', text });
      this.lastHeardAt = this.now();
      return true;
    }
    const controller = new AbortController();
    this.speaking = controller;
    this.setState('speaking');
    try {
      await this.d.tts.speak(text, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) return false;
      console.warn(JSON.stringify({ msg: 'voice failed', error: (err as Error).message.slice(0, 200) }));
      this.voiceFailed = true;
      this.d.send({ type: 'say', text });
    }
    if (this.speaking === controller) this.speaking = null;
    // the silence limit counts from when the agent stops talking
    this.lastHeardAt = this.now();
    return id === this.turnId && !controller.signal.aborted;
  }

  /** Recognition broke down. The call stays up, and the page listens instead. */
  onRecognizerFailed(): void {
    if (this.state !== 'ended') this.d.send({ type: 'use_recognizer' });
  }

  /** Call every second. Ends the call on either limit, never while the person is mid-turn on silence. */
  async tick(): Promise<void> {
    if (this.state === 'ended' || this.state === 'idle') return;
    const now = this.now();
    if (now - this.startedAt >= CALL_LIMIT_MS) {
      await this.finish('cap', CAP_LINE);
      return;
    }
    if (this.state === 'listening' && now - this.lastHeardAt >= SILENCE_LIMIT_MS) await this.finish('silence', SILENCE_LINE);
  }

  hangUp(): void {
    if (this.state === 'ended') return;
    this.turnId++;
    this.speaking?.abort();
    this.state = 'ended';
    this.d.send({ type: 'ended', reason: 'hangup' });
  }

  private async finish(reason: EndReason, line: string): Promise<void> {
    const id = ++this.turnId;
    this.speaking?.abort();
    await this.say(line, id);
    this.state = 'ended';
    this.d.send({ type: 'ended', reason });
  }
}
