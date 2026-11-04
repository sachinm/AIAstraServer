# The voice testbed (plan, 2026-11-02)

Sachin's brief: "build a testbed along with the agent for testing where we can track the loss, the jitters, all the issues" with
real-time WebRTC and TTS. "Don't release it but make it fully able to work through the issues with bad connection, no connection,
slow connection, fast connection that gets throttled."

## 1. Start: facts checked

- `docs/assistant/02` is the design: three tiers (Live, Device voice, Tap to hear), LiveKit, Transcribe, Nemotron, Polly.
- AWS is not reachable from agents, so LiveKit, Transcribe and Polly cannot be called yet. The real model has never been called.
- Playwright and esbuild are already in the web repo. No installs are needed.
- The machine is memory-limited, so scenarios run one at a time.

## 2. End goal

One command that makes real WebRTC calls through a network we can break on purpose, reads what the browser itself reports, and
fails if the agent leaves a person in silence or at the wrong tier.

## 3. Deliverable

- Web `src/lib/voice/`: `quality.ts` (the tier rules) and `client.ts` (the call and the turns). Not mounted on any page.
- Web `testbed/voice/`: relay and control server, client and agent pages, scenario runner, live control page, HTML report. Not in
  the production build.
- Server `src/voice/`: the agent's turn logic, with speech-to-text, the answer and text-to-speech behind interfaces. Fake providers
  only for now. Nothing routes to it.

## 4. How it works

### Backend (`testbed/voice/server.mjs`)

Two real Chromium pages make a real WebRTC call. Neither can reach the other directly: the server rewrites each side's ICE candidate
so every packet crosses a UDP relay. The relay breaks traffic per a profile that can change mid-call:
`{ lossPct, delayMs, jitterMs, rateKbps, blackout }`. Rate is a token bucket with a 200 ms queue, so throttling looks like a real
bottleneck: delay first, then tail drop. It counts what it did to every packet, so injected loss can be compared with measured loss.

### API (testbed only, local)

| Call | Does |
|---|---|
| `POST /signal/:side`, `GET /signal/:side` | Signalling between the pages, with candidates rewritten |
| `POST /ask` | Stand-in for `/api/assistant/ask`, with settable delay and failure |
| `GET /state`, `POST /profile`, `POST /ask-mode` | Read the relay's counters and the client's events; change the network |
| `POST /report` | The client page's events, for the live view |

### Frontend (client page and control page)

The client page runs the real `VoiceClient`. Each second it reads `getStats`: loss, jitter, round trip, concealed samples, jitter
buffer delay, bitrate. It records every tier change, answer and spoken line. The control page charts these live, with buttons for
each network condition.

### UI/UX

None for visitors. No page in the product changes.

## 5. Scenarios

Fast; light loss; 15% and 30% loss; high latency; heavy jitter; 64 kbps; 24 kbps; fast then throttled and recovered; a short spike;
10 s blackout and recovery; permanent no connection; agent gone with the web up; offline at start; microphone refused; a flapping
connection; a slow answer server.

Each asserts on the tier reached, how long it took, whether a person got an answer, and whether the relay's injected loss matches
what the browser measured.

## 6. What it does not prove

- **It uses plain WebRTC, not LiveKit.** LiveKit adds its own server, TURN and reconnection. The tier rules carry over; the timings
  must be run again after the spike in `docs/assistant/02`.
- **Audio is the browser's fake device.** It measures transport health, not whether speech sounds good or is understood.
- **Questions go over the data channel,** standing in for speech recognized on the server.
- **Headless Chromium on Windows is not a phone.** iOS and Android audio rules still need real devices.

## 7. Action steps

1. Tier rules and client, with unit tests.
2. Relay and signalling; prove a call crosses it and the counters match.
3. Scenarios, report, live control page.
4. Agent turn logic on the server, with fake providers and tests.
5. Merge to `develop`. No release.

## 8. Recommendation

Build it this way, with the relay in Node, rather than OS-level shaping (`netsh`, `clumsy`, `tc`). OS shaping needs admin rights and
would throttle the whole machine, while this runs anywhere with one command and can break each call separately.
