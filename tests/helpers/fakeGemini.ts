/**
 * Local fake of the Gemini REST API for tests and the offline demo: records every request body (so tests can assert the prompt
 * layout used for prefix caching), answers specialists with structured JSON that cites real and bogus evidence ids (to exercise
 * the grounding gate), answers intake with JSON, and streams a markdown answer for the synthesizer. Not a quality model.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeRequest {
  model: string;
  stream: boolean;
  body: any;
  at: number;
}

export interface FakeGeminiOptions {
  /** ms to wait before answering a non-streaming (specialist / intake) call */
  specialistDelayMs?: number;
  /** analyst names whose call should fail with HTTP 500 */
  failAnalysts?: string[];
  /** ms between streamed chunks */
  chunkDelayMs?: number;
  /** extra text appended to the streamed answer */
  answer?: string;
  /** thought-summary chunks streamed before the answer, only when the request sets thinkingConfig.includeThoughts */
  thoughts?: string[];
}

export interface FakeGemini {
  url: string;
  requests: FakeRequest[];
  /** bodies of explicit prompt-cache creations (POST /cachedContents) */
  cacheCreates: unknown[];
  close: () => Promise<void>;
  reset: () => void;
}

function userText(body: any): string[] {
  return (body?.contents?.[0]?.parts ?? []).map((p: any) => String(p.text ?? ''));
}

/** Canned markdown per requested format, so the UI renders realistic tables, lists and headings. Not astrology. */
export function cannedAnswer(prompt: string): string {
  const TEMPLATE_FORMAT: Record<string, string> = { T1: "direct", T2: "timeline", T3: "narrative", T4: "narrative", T5: "factor_table", T6: "narrative", T7: "narrative", T8: "narrative", T9: "watchlist", T10: "direct" };
  const tpl = /Template (T\d+) —/.exec(prompt)?.[1];
  const fmt = (tpl && TEMPLATE_FORMAT[tpl]) || /Format `(\w+)`/.exec(prompt)?.[1] || "direct";
  const head = "**Direct answer (demo text):** the chart shows a gradual improvement, with the strongest window starting in November 2026.\n\n";
  switch (fmt) {
    case "timeline":
      return head + "| Window | Dasha (MD-AD-PD) | Transit trigger | Indication | Watch for |\n|---|---|---|---|---|\n| Nov 2026 - Jan 2027 | Saturn-Ketu-Mercury | Jupiter in Leo | moderate indication | steady offers |\n| Jun 2027 - Aug 2027 | Saturn-Venus-Sun | Saturn in Aries | weak / possible | delays |\n\n### How to read this\n\nThe promise is moderate, the dasha supports, and the transit trigger agrees in the first window.";
    case "factor_table":
      return head + "| Factor | Placement | Strength | Effect on the question |\n|---|---|---|---|\n| 10th lord | Mercury in the 9th | friend | support through fortune |\n| D-10 lagna | Scorpio | - | depth, research |\n\nThe factors lean towards a considered change later in the year.";
    case "narrative":
      return head + "### What is in your chart\n\nDemo narrative text.\n\n### Why now (dasha)\n\nSaturn-Ketu period.\n\n### The trigger (transits)\n\nKetu reaches natal Jupiter in June 2028.\n\n### What to expect\n\nPatience now, clarity later.";
    case "watchlist":
      return head + "1. **Early November** - Jupiter stays in Leo; look for steady news.\n2. **Late November** - Moon passes the 4th; avoid rushing signatures.\n3. **December 6** - Ketu enters Cancer; revisit the paperwork.";
    default:
      return head + "- 10th lord Mercury sits in the 9th house.\n- Saturn-Ketu-Sun is running now.\n- No outcome is promised; this is an indication only.\n\nOutlook: steady.";
  }
}

function analystOf(parts: string[]): string | null {
  const m = /ANALYST: (\w+)/.exec(parts.join('\n'));
  return m ? m[1]! : null;
}

export async function startFakeGemini(opts: FakeGeminiOptions = {}): Promise<FakeGemini> {
  const requests: FakeRequest[] = [];
  const cacheCreates: unknown[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      // explicit prompt cache: create returns a name; requests that reference it report the cached tokens
      if (/\/cachedContents/.test(req.url ?? '')) {
        cacheCreates.push(body);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ name: `cachedContents/fake-${cacheCreates.length}`, expireTime: new Date(Date.now() + 3600_000).toISOString() }));
        return;
      }
      const m = /\/models\/([^:]+):(generateContent|streamGenerateContent)/.exec(req.url ?? '');
      const model = m?.[1] ?? '';
      const stream = m?.[2] === 'streamGenerateContent';
      requests.push({ model, stream, body, at: Date.now() });
      const parts = userText(body);
      const promptTokens = Math.ceil(parts.join('').length / 3.2) + Math.ceil(String(body?.systemInstruction?.parts?.[0]?.text ?? '').length / 3.2);
      const seen = requests.slice(0, -1).some((r) => JSON.stringify(r.body?.systemInstruction) === JSON.stringify(body?.systemInstruction) && userText(r.body)[0] === parts[0]);
      const usage = { promptTokenCount: promptTokens + (body?.cachedContent ? 3000 : 0), cachedContentTokenCount: body?.cachedContent ? 3000 : seen ? Math.floor(promptTokens * 0.7) : 0, candidatesTokenCount: 220, thoughtsTokenCount: 0 };

      if (!stream) {
        const analyst = analystOf(parts);
        await new Promise((r) => setTimeout(r, opts.specialistDelayMs ?? 0));
        if (analyst && opts.failAnalysts?.includes(analyst)) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: `fake failure for ${analyst}` } }));
          return;
        }
        let payload: unknown;
        if (body?.generationConfig?.responseSchema?.properties?.subjects) {
          payload = {
            subjects: [{ id: 'career_work', weight: 1 }], horizon: '1y', questionType: 'timing', format: 'timeline', focusPoints: [], mentionsPlanets: [],
            confidence: 0.9, clarifyText: 'You are asking about career over the next year.', followUps: [], safety: 'ok',
          };
        } else {
          payload = {
            verdict: 'moderate',
            claims: [
              { text: `[${analyst}] The 10th lord Mercury sits in the 9th house.`, evidence: ['detail.houses.10.lord', 'detail.houses.10.lord_house'], polarity: 'supports', weight: 3 },
              { text: `[${analyst}] A claim with an id that is not in the pack.`, evidence: ['nope.not.in.pack'], polarity: 'neutral', weight: 1 },
            ],
            windows: [
              { from: '2026-11-01', to: '2027-03-01', label: 'Saturn-Ketu-Sun supporter', polarity: 'favourable', evidence: ['dasha.current.md'] },
              { from: '2019-01-01', to: '2019-06-01', label: 'outside horizon', polarity: 'favourable', evidence: [] },
            ],
            caveats: [],
            keyFacts: ['detail.houses.10.lord'],
          };
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: 'STOP' }], usageMetadata: usage }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const text = opts.answer ?? cannedAnswer(parts.join('\n'));
      if (opts.thoughts?.length && body?.generationConfig?.thinkingConfig?.includeThoughts === true) {
        for (const t of opts.thoughts) {
          res.write(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t, thought: true }] } }] })}\n\n`);
          if (opts.chunkDelayMs) await new Promise((r) => setTimeout(r, opts.chunkDelayMs));
        }
      }
      const pieces = text.match(/.{1,24}/gs) ?? [text];
      for (let i = 0; i < pieces.length; i++) {
        const last = i === pieces.length - 1;
        res.write(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: pieces[i] }] }, ...(last ? { finishReason: 'STOP' } : {}) }], ...(last ? { usageMetadata: usage } : {}) })}\n\n`);
        if (opts.chunkDelayMs) await new Promise((r) => setTimeout(r, opts.chunkDelayMs));
      }
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/v1beta/models`,
    requests,
    cacheCreates,
    reset: () => {
      requests.length = 0;
      cacheCreates.length = 0;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
