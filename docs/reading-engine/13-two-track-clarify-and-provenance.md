# 13 — Two-track flow: clarify while the reading agents already work, and prove the journey

Added 2026-10-24. Refines file 04 (graph), file 09 (templates) and the bucket/clarify brief sent to the dev session. Two ideas from Sachin:

1. After the user asks, a **clarifier agent** narrows the question criterion by criterion (timeframe, who else is involved, background not provided) in sub-second turns, **while the reading agents have already been sent the charts they need** (cached or refreshed) and keep narrowing as the clarification proceeds (dashas once the timeframe is known).
2. The product must give the **most accurate, probabilistically honest** answer and be able to **record and demonstrate how it got there**: what it examined on the way.

## 1. The two tracks

```
t0  question arrives ──► rules classifier (≤5 ms): bucket, slots found, slots missing
        │
        ├─ Track A (conversation, user-paced) ───────────────────────────────────────────┐
        │   clarifier agent asks for the next missing criterion (≤1 s per turn)        │
        │   ← user answers (chip or text) → slots update → next criterion or READY      │
        │   proposes the exact query → user confirms/edits → CONFIRMED                   │
        │                                                                               │
        └─ Track B (reading pipeline, machine-paced, starts at t0+10 ms) ───────────────┤
            B1 load dossier + transit snapshot (cache) ── ensure Gemini cache (refresh if dossier hash changed)
            B2 build the WIDE pack for the bucket (all plausible vargas, 3-year horizon)
            B3 stage-1 specialists that do not depend on unknown slots:
                 promise (static), nakshatra (person-centric), dasha with WIDE horizon
            B4 on slot `horizon` resolved → narrow dasha windows (filter, no model call) and
               dispatch transit specialist for that horizon
            B5 on slot `person`/`other_person` resolved → add overlay pack, dispatch compatibility if needed
            B6 on slot `sub_bucket`/`background` resolved → annotate brief (e.g. currently employed)
            B7 reconcile when all required findings are in AND Track A is CONFIRMED
            B8 synthesize (streams) ───────────────────────────────────────────────────────┘
```

The user's think time on Track A is where Track B does its work. In the common case the specialists finish before the user taps "Yes, read it", so the first answer token appears 2–4 s after confirmation instead of 10–15 s.

### What "already sent the charts" means concretely

- The **dossier** (D-1…D-60 as available, dashas, strengths, arudhas, nakshatra profile) lives in `kundli_facts`; Track B loads it in one query at t0.
- The **Gemini explicit cache** per user (file 05 §4) holds persona + method + full dossier. At t0 Track B checks the pointer; if the dossier hash changed (new sync) it recreates the cache ("refreshed for the reading"); otherwise it is a hit. The specialists then send only their small packs.
- The **wide pack** for the bucket is built from the frame table (file 02/10) with every varga the bucket might need, so no re-fetch is needed when the clarifier adds detail; narrowing is subtraction.
- Stage-1 specialists run on inputs that cannot change during clarification (the natal promise, the nakshatra layers, the dasha list over a wide horizon). Stage-2 specialists (transit for the exact horizon, compatibility for a second chart) wait for the slot that defines them.

### Narrowing without re-asking the model

Dasha and transit windows are data. When the horizon changes from "wide" to "Nov 2026 – Apr 2027", reconcile filters the dasha specialist's windows and claims by date; only the transit specialist needs the exact horizon, and it is dispatched the moment the slot resolves. If the user widens the horizon later, the wide dasha findings are still valid; only transit re-runs.

## 2. The clarifier agent

**Purpose**: turn a vague question into an exact, answerable query in at most two short exchanges, and teach the user what astrology can answer while doing it.

**Inputs** per turn: the question and prior turns; the bucket and its required slots (from the taxonomy: `subject_person`, `horizon`, `specific_event`/`sub_bucket`, `other_person`, `background`); the slots already filled by rules; a **headline facts card** (lagna, Moon, running MD–AD–PD with end dates, next period) so questions can be chart-aware ("Your Saturn–Mercury period runs until 24 Jul 2026; shall I look up to then, or through the next period as well?"); the coaching card for the bucket.

**Output** (JSON, closed schema, ≤ 150 tokens, no thinking, `READING_MODEL_INTAKE`):

```ts
ClarifierTurn = {
  ready: boolean;                         // true when all required slots are filled
  ask?: { criterion: SlotId; question: string; chips: string[]; allowFreeText: boolean };
  resolved: Partial<Slots>;               // slots inferred from the latest user text
  exactQuery?: string;                    // shown for confirmation when ready
  guidance?: string;                      // one line of "how to ask" when the question is unanswerable as posed
  assumedDefaults?: Partial<Slots>;       // when the cap is reached
}
```

**Rules**: one criterion per turn; question ≤ 18 words; options first (chips), free text allowed; never ask what the user already said; horizon first unless the bucket is ambiguous; at most 2 turns, then proceed with stated defaults ("I assumed the next 12 months"); skip the model entirely when rules filled every required slot (`ready` is computed in TypeScript); sub-second budget (p95 ≤ 900 ms). Hindi/Hinglish inputs are understood; replies are in the user's language.

**Criteria and their chips** (defaults in bold):

| Criterion | Chips | Default |
|---|---|---|
| horizon | Next 3 months · **Next 6 months** · This year · Next 3 years · Specific dates… | 6 months (12 for marriage/property, 3 for "now" questions) |
| subject_person | **Me** · Partner · Child · Parent · Someone else (needs their chart) | Me |
| sub_bucket (career) | Changing jobs · Promotion / recognition · Finding a job · Trouble with boss / team · Business | from text, else ask |
| background (career) | Employed now · Between jobs · Studying · Self-employed | ask only if it changes the frame |
| other_person (relationship) | Current partner · Someone new · Not sure yet | ask only for compatibility |
| specific_event | free text: "promotion in March", "moving to Dubai" | optional |

**State machine**: `CLASSIFIED → (missing slots? ASKING : READY) → ASKING ⇄ user → READY → PROPOSED (exact query shown) → CONFIRMED | EDITED → READY → … | ABANDONED (10 min)`. Persisted in `reading_runs` (`intent`, `clarify_turns[]`, `intent_confirmed`), resumable with the LangGraph checkpointer.

**Coaching inline**: when the question cannot be answered as posed (exact lottery numbers, date of death, "will it rain on my wedding"), the clarifier returns `guidance` and the nearest answerable rewrite as a chip, never a flat refusal.

## 3. Realisation in LangGraph

One graph per run with two parallel branches from `classify`:

- `clarifier` subgraph: nodes `plan_question → interrupt(ask) → absorb_answer`, loops until `ready`, then `propose → interrupt(confirm)`. Each interrupt ends the HTTP response (SSE `clarify` or `propose` event with `runId`); `POST /api/chat/answer {runId, criterion, value}` and `POST /api/chat/confirm` resume via `Command({ resume })`.
- `pipeline` subgraph: `prepare → stage1 (Send: promise, nakshatra, dasha_wide)`; a conditional edge on state `slots.horizon` releases `stage2 (Send: transit, [compatibility])`; `await_confirm` is a node that completes when `state.confirmed` is true; then `reconcile → synthesize → persist`.
- State keys written by both tracks use reducers (`slots` merge, `findings` concat). Because interrupts suspend the whole run, Track B's stage-1 work is launched **before** the first interrupt (same super-step as `plan_question`) and its results land in the checkpoint; stage-2 is launched on the resume that resolves the slot. This keeps "already working while you answer" true without background threads outliving a Lambda invocation: the heavy model calls happen inside the resumed invocations, each of which also pre-dispatches the next stage before interrupting again.
- Lambda consideration: a resume invocation that only needs to ask the next question returns in ~1 s; the invocation that receives the final confirm is the one that streams. Stage-1 calls started before an interrupt must be awaited within that invocation (12 s cap) so nothing is orphaned.
- Fast path: when rules fill every slot and `READING_CLARIFY_MODE=when_missing`, there is no interrupt; both branches run and join in one invocation, exactly as file 04.

## 4. Provenance: recording and demonstrating the journey

Every run writes `reading_runs.trace`, an ordered, append-only list:

```ts
TraceStep = {
  t: number;                 // ms from t0
  node: string;              // classify | clarifier.ask | prepare | promise | dasha | transit | nakshatra | reconcile | synthesize
  examined: string[];        // fact ids read (e.g. houses.10.lord, vargas.D10.houses.10, dasha.vim.periods[3], transit.Sa.2026-11)
  charts: string[];          // D1, D10, D9 …
  rulesApplied: Array<{ id: string; tradition: 'parashara'|'jaimini'|'nakshatra'|'tajaka'|'kuta'|'kp_starlord'; text: string }>;
  claims: Claim[];           // with evidence ids and polarity
  dropped: Array<{ claim: string; reason: 'no_evidence'|'outside_horizon'|'policy' }>;
  decision?: { layer: 'L1'|'L2'|'L3'|'L4'|'L5'; score: number } | { verdict: string; agreement: string; deciders: string[] };
  model?: { id: string; inputTokens: number; outputTokens: number; cached: number; ms: number };
}
```

What the user sees ("How I read this", collapsed under every reading, and a full "Reading receipt" page per run):

1. **Charts examined**: D-1, D-10, D-9 … with why each was used (from the bucket frame).
2. **Factors checked**: house lords and placements, karakas, arudhas, strengths, each as a short fact line with its chart.
3. **Timing considered**: the dasha periods in the horizon with their class (deliverer/supporter/obstructor) and the transits that mattered.
4. **Rules applied**: the named rules with their tradition tag.
5. **Convergence table**: L1…L5 scores, the deciders, the agreement label, the verdict tier, and the caveats.
6. **What would change this answer**: one line generated from the weakest layer ("If the Saturn transit over your 10th were absent, this would drop to weak").
7. Export: JSON receipt and PDF.

Internally the trace feeds: the grounding checker (every prose assertion must map to an `examined` id), method-coverage evals (file 07 §3 item 5), the per-stage latency table, cost accounting, and the calibration work in file 14 (when a window is later confirmed or denied by the user, the trace tells us which rules and layers were responsible).

## 5. Probabilistic honesty

- Today: verdict tiers from the convergence rule (file 11 §1) with the fixed vocabulary; numeric scores are logged, not shown.
- Next: once the life-timeline feedback (file 14) accumulates, scores are mapped to calibrated probabilities per event class; the reading may then say "about 6 in 10 charts with this configuration saw the event in such a window" with the calibration version in the trace. Until then no percentages in prose.
- Always: disagreement between layers is stated, data gaps are named, and the answer says what it did **not** examine.

## 6. Tests to add

- Clarifier: schema validity on every turn; one criterion per turn; cap at two; defaults stated; no re-asking a filled slot; Hinglish answers resolve the slot; sub-second budget with the model stubbed and with a live smoke.
- Two-track: stage-1 findings exist in the checkpoint before the first `clarify` event is sent; stage-2 dispatches on horizon resolution; widening the horizon re-runs only transit; abandoned runs expire; the fast path produces no interrupt.
- Provenance: every claim in the final brief has evidence ids present in `trace.examined`; the receipt renders for the 12 golden questions; method-coverage ids per bucket are present.
