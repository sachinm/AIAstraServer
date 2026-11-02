# The public voice agent (design, 2026-11-02)

Sachin's brief: turn the public assistant into a voice agent. You click a button and talk with it. Real-time WebRTC, and on a
bad connection it degrades into text-to-speech. Never a type-text agent.

This replaces the typed box in `docs/assistant/01`. What it says, what it refuses and what it logs do not change. Nothing here is
built yet.

## 1. Start: facts checked

- **Built, not deployed:** `POST /api/assistant/ask` and `/visit`, the guards in `src/assistant/guard.ts`, the two log tables
  (live, empty), and a typed chat box on web `develop`.
- **The API cannot host a call.** It is a Lambda behind CloudFront (`Dockerfile.lambda`: `RESPONSE_STREAM`). WebRTC needs an
  always-on process with open UDP ports. So this needs a new always-on server, the first in the product.
- **DNS is on Cloudflare**, and its proxy does not carry WebRTC UDP. The media host must be a DNS-only name.
- **Speech today:** only `useSpeechRecognition` in the signed-in chat. Nothing plays audio. The server has no Polly or Transcribe
  client. `bedrock.ts` does Converse only, with no streaming.
- **No AWS access from agents.** Sachin creates the infrastructure.

Checked on the web tonight, from secondary sources where marked. Confirm before relying on them:

| Fact | Source strength |
|---|---|
| Transcribe streaming takes a WebSocket with a presigned URL | AWS blog |
| Polly list prices: Neural $16, Generative $30 per million characters | Third-party aggregators only |
| Polly Hindi voices Kiara and Arjun on Generative | One news article |
| Nova 2 Sonic speaks Hindi; uses an HTTP/2 bidirectional stream; us-east-1, us-west-2, Tokyo | AWS announcement |
| Chrome's browser speech recognition sends raw audio to Google | Older forum posts |
| LiveKit has an AWS plugin covering these services | LiveKit's README |
| Transcribe price, real Nemotron latency, iOS speech rules | **Not found. Measure or read before building** |

## 2. End goal

A visitor clicks the button, allows the microphone, and is talking. The agent greets them, listens, and answers aloud in under
about 1.5 seconds. They can interrupt it. There is no text box anywhere. Words appear as captions only. If the connection worsens,
the conversation carries on with a simpler voice instead of breaking, and the person is told in one spoken line.

## 3. Deliverable

- **Voice server:** LiveKit (open source) with TURN on 443, plus an agent worker. One small EC2 instance in us-east-1.
- **Agent worker:** Transcribe in, Nemotron on Bedrock (gpt-oss fallback), Polly out. It reuses `src/assistant/guard.ts` and the log.
- **API:** `POST /api/assistant/voice/session` issues a short-lived room token. `/api/assistant/ask` stays, as the degraded brain.
- **Web:** `VoiceAgent.tsx` replaces `AssistantWidget.tsx`: one button, captions, states, no input field.
- **Docs:** Privacy Policy on voice, the controls note, a runbook, and infrastructure as code.

## 4. How it works when done

### Backend

1. Button click: the page asks the API for a session. The API checks limits and returns a LiveKit token for a one-person room,
   valid 60 seconds.
2. The browser joins by WebRTC. The agent joins the room and greets.
3. **Each turn:** Opus audio to the worker, voice-activity detection, Transcribe streaming, final transcript, `fixedAnswer` and
   declined topics first. Then the model, then `cleanAnswer`, and only then Polly. **Nothing is spoken before it is checked.**
4. **Interrupting:** when the person speaks over it, playback stops and the turn is abandoned.
5. **End:** a click, 20 seconds of silence, or a 3-minute cap. The room closes. **Audio is never stored**, only the transcript and
   answer, in `assistant_questions`, kept 90 days.

Limits: 3 minutes per call, 3 calls per visit per hour, a site-wide minutes cap per day, and 20 calls at once. Over a limit, the
button speaks one fixed line and does not connect.

### API

| Call | Request | Response | Errors |
|---|---|---|---|
| `POST /api/assistant/voice/session` | `{ visitId, turnstileToken, lang? }` | `{ url, token, limits }` | `403` failed check, `429` limit, `503` voice server down: the page goes to the TTS tier |
| Data channel, server to page | caption, state, quality messages | | |
| `POST /api/assistant/ask` | `{ question, visitId }` from the TTS tier | `{ answer, verdict, cta }` | as today |

### Frontend: the three tiers

Quality is read from WebRTC's own stats (round-trip time, packet loss, jitter) every 2 seconds, with hysteresis so it does not flap.

| Tier | When | You speak by | It answers by |
|---|---|---|---|
| **1. Live** | Round trip under 400 ms, loss under 5% | WebRTC | Polly audio over WebRTC, interruptible |
| **2. Device voice** | Loss 5 to 25% or round trip over 400 ms for 6 s, or the voice server is down | WebRTC while it holds (Opus works at low bitrates), otherwise the browser's recognizer | **Text answer, spoken by the device's own voice (`speechSynthesis`)**. Only words travel, so it needs almost no bandwidth |
| **3. Tap to hear** | No usable connection for speech, no recognizer, or the microphone is refused | **Tapping a suggested question** | Answers bundled in the page, spoken by the device voice. Works offline |

It moves back up when quality holds for 15 seconds. No tier has a text box.

Tier 2's fallback recognizer sends audio to Google on Chrome, which cuts against the privacy plan. It is used only when WebRTC
has failed, and the Privacy Policy will name it.

### UI/UX

- **Button:** "Talk to AI AdAstra", bottom left, on the same pages as today: all public pages, not `/signin`, not `/signup/details`.
- **Before the microphone prompt:** "Voice conversation. Not a reading. We keep what's said as text, never the audio."
- **States:** connecting, listening (rings follow your voice), thinking, speaking, reconnecting, ended.
- **Captions** of both sides, read-only.
- **On a drop:** spoken once, "The connection is weak, so I'll keep this simple."
- **Sign-up link** appears, and is said, when the answer calls for it.
- **Hindi:** the page's language picks voices, and Transcribe's language detection handles the rest (measure it first).

## 5. Architecture

```
Browser
  |  HTTPS  ->  CloudFront -> Lambda API:  session token, limits, log, /ask for tier 2
  |  WebRTC ->  rtc.vedic-astrology.app (Cloudflare DNS only, not proxied)
                 EC2: LiveKit server + TURN on 443
                      agent worker: Transcribe -> guard -> Nemotron -> guard -> Polly
                      -> Render Postgres: the existing log tables
```

The Lambda stays stateless. Media never passes through it. If the voice server dies, the site is unaffected and the button drops
to tier 2.

## 6. Ingredients

| Item | Who |
|---|---|
| EC2 instance, security group (UDP range, TCP 443, 7881), Elastic IP, IAM role (Transcribe, Polly, Bedrock for the two models) | Sachin, from a script agents write |
| DNS-only `rtc.vedic-astrology.app` record in Cloudflare | Sachin |
| LiveKit API key and secret in Secrets Manager; DB URL for the worker | Sachin |
| CORS and Lambda env: `LIVEKIT_URL`, `VOICE_ENABLED`, `VOICE_DAILY_MINUTES` | Deploy session |
| Bedrock model access (step 7 of the CloudShell file) | Sachin |
| Worker, session route, web component, tests | Agents |
| Lawyer's read of voice: recording and biometric laws | Sachin |

**Running cost:** one always-on small instance plus per-use Transcribe, Polly, Bedrock and data. To be priced in step 1. The daily
minutes cap bounds the use part; I have not put a number here because the Transcribe price was not found.

## 7. Action steps

1. **Spike, 1 day, needs the AWS box.** A bare room with the three services, no UI. Measure time to first audio, on good and
   throttled networks, in English and Hindi. Read the real prices. **Go/no-go on latency here.**
2. Agent worker with the guards and log, tests against prying transcripts (parallel with 3).
3. Session route, limits, Turnstile (parallel with 2).
4. `VoiceAgent.tsx`, tier 1, states and captions.
5. Tiers 2 and 3: quality monitor, device voice, bundled answers. Test on real iPhone and Android, because iOS audio rules need
   real devices.
6. Privacy Policy, controls note, runbook. Sachin approves the words.
7. Remove `AssistantWidget.tsx` and the typed box.
8. Deploy behind `VOICE_ENABLED`. Try to break it on staging. Turn on.

## 8. Phases

- **Phase 1, the spike (step 1):** proves it can be fast enough.
- **Phase 2, live voice (steps 2 to 4):** about 2 to 3 working days.
- **Phase 3, degradation and launch (steps 5 to 8):** about 2 working days plus device testing.

**Not for tomorrow's demo.** It needs a new server and real-device testing. For the demo, leave the assistant off the site.

## 9. Recommendation

**Self-hosted LiveKit with Transcribe, Nemotron and Polly as separate steps.**

- **Why not Nova Sonic**, though it is one neat speech-to-speech model: it turns speech straight into speech, so the words cannot be
  checked before they are spoken. Your rule that it never reveals how the product works matters more than simplicity. It is also not
  an open model, which you asked for.
- **Why not hosted LiveKit Cloud:** faster to start, but voice would leave AWS, against the privacy plan.
- **Why not Lambda or plain WebSockets:** you asked for WebRTC, and it is what holds up on bad connections.

## 10. Decisions for Sachin

1. **Tap-to-hear questions in tier 3.** Recommended yes: they are not typing, and without them someone who cannot speak, is on a bad
   connection or refuses the microphone gets nothing at all, which is also a legal accessibility risk.
2. **A new always-on server.** It is the first thing in the product that runs all the time, so it needs someone to patch it.
