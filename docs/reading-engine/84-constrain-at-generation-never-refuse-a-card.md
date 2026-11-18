# 84 · Constrain at generation, never refuse a card

Written 2026-11-18. Sachin asked what "stops a card" means, whether the person sees an error, and whether there is a
better design. Builds on doc 82 (no word filters) and doc 83 (one card writer). For review; no code until Sachin agrees.

## 1. Start: what each remaining check does to the page today (checked against code)

| Check | Where | What the person sees |
| --- | --- | --- |
| A body sentence cites no Oracle paragraph or key | v2 `validatePersonalDoc` | That sentence is missing; the card shows the rest |
| No body sentence left | v2 | The card is "withheld": the Oracle headline stands in, else "Not enough in your chart to say this with confidence." |
| A card date or pattern span is not an Oracle window | v2 | That date or pattern is missing; the card shows |
| Fewer than 8 of 11 Oracle areas came back | v2 `servesPage` | The build is not stored: the page keeps the last reading, or shows **"The full reading did not finish for this card"** on every card when there is none (what happened on 18 Nov) |
| Unknown evidence key, missing span, empty field, no knot or gift | v3 `checkOracleCard`, `checkPersonalCard`, `checkAgainstLedger` (Phase B and doc 70) | The card is refused, asked again once, then shown as **"did not finish"** (`cards/state.ts cardStateOf` → `failed`) |
| The model call fails or the JSON does not parse | all | The same "did not finish" card |

So "stops a card" means two different things. A grounding miss in v2 removes one piece of a card. A grounding miss in
v3 removes the whole card, and the person sees an error card until the next reading.

## 2. End goal

- The person never sees an error card because of what the model wrote. "Did not finish" is shown only when the model
  call itself failed and there is no earlier reading of that card.
- Grounding is enforced **before** the model writes, not judged after:
  - **Evidence keys:** the model can only pick from the card's own keys (a response-schema `enum`).
  - **Dates:** the model never writes a date. It picks a window id (`w1`…`wN`) from the engine's stored windows, and
    code fills in `from` and `to` from the stored row. An invented date cannot happen, and Node still computes nothing.
  - **Required fields:** they are marked `required` in the response schema, so the model has to return them.
- After the call, code only fits the answer to the card: an unknown window id or key is left out, an empty optional
  section is hidden, and a missing span shows the card without it. **No answer that parses is refused.**
- A card whose call failed shows its last good reading marked "from <date>", and is re-queued.

## 3. Deliverable

- `src/reading/cards/schema.ts` (new): builds each card's response schema with `enum` lists for its evidence keys and
  window ids, and `required` fields. It replaces the free-text key and date fields in `cards/group.ts` and
  `cards/oracle.ts`.
- `src/reading/cards/fit.ts` (new): `fitCard(raw, ctx)` → `{ card, notes }`. It maps window ids to stored dates, drops
  unknown ids silently, hides empty sections and redacts engine names. It never returns null for a parsed answer.
  It replaces `precheckCard`, `checkOracleCard`, `checkAgainstLedger` and `checkPersonalCard` in the per-card path.
- `cards/run.ts`: the repair call is used only for a failed call or an unparsable answer, not for content.
- `cards/state.ts cardStateOf`: when a card has no new reading, it shows the last stored reading of that card
  (`stale`) before `failed`.
- Prompt changes: the card prompt lists the windows by id and the keys by name. **The prompt hash changes**, so every
  stored card is rebuilt once on its next read (paid; Sachin's yes).
- Tests: the schema builder, `fitCard` (no parsed answer refused), and a stale fallback on a failed call.

## 4. How it works when done

- **Backend:** per card, the code builds the schema (keys and window ids from the stored ledger), makes one call
  (doc 70 timeouts), fits the answer, and stores it. A call error or a parse failure gets one repair call. If that
  also fails, the last good reading of the card stays and the card is re-queued for the next build.
- **API:** `GET /api/self/v3` is unchanged. A card's `state` can now be `ready`, `stale` (the last good reading, with
  `fromBuiltAt`), `reading`, `queued` or `failed`. `failed` appears only with no stored reading at all.
- **UI:** a stale card shows its text with "From your reading of <date>". "Did not finish" appears only for a card
  never read whose call failed.

## 5. Architecture

Stored ledger (Radha rows only) → per-card schema with enums → Gemini (constrained output) → `fitCard` (fit, never
refuse) → `technique_outputs` → GET. The code computes nothing astrological. It copies stored window dates by id.

## 6. Ingredients

- Gemini `responseSchema` with `enum` on string fields. It is supported, but nothing in this repo uses it yet. Keep
  each enum to the card's own keys (tens, not hundreds) to stay inside the schema size limit.
- No migration, no env change, no IAM change.
- Owners: a dev agent for the code; Sachin for the one-time paid rebuild.

## 7. Action steps

1. `cards/schema.ts` with tests (enum lists, required fields, window ids).
2. `cards/fit.ts` with tests; switch `group.ts` and `cards/oracle.ts` to schema plus fit.
3. The card prompt: windows by id, keys by name (prompt hash change).
4. `cardStateOf` stale fallback, and the web copy "From your reading of <date>".
5. Staging: one refresh on c584c0a3 with a yes; check no card is refused; screenshot.

Steps 1 and 4 can run in parallel; step 2 needs step 1.

## 8. Phases

- **Phase A (steps 1–4):** code and tests, shipped behind `CARDS_SCHEMA_V2=1`.
- **Phase B (step 5):** the flag on in staging, then one verified refresh. Closing check: every board card is `ready`
  or `stale`, and none is `failed`.
- **Deferred:** the same constrain-then-fit approach for the v2 Oracle, only if doc 83 keeps it. Doc 83 retires it.

## 9. Recommendation

Constrain the model's output with the schema (enums for keys and window ids, required fields), then fit the answer in
code and never refuse a parsed card. Fall back to the card's last good reading when a call fails. That way grounding
holds by construction, the code keeps no rule that judges content, and an error card appears only when there is truly
nothing to show.

| Option | Verdict |
| --- | --- |
| Schema enums + window ids + fit, never refuse; stale fallback | **Chosen** |
| Keep the post-checks but repair instead of refusing | Rejected: it still judges after the fact, and a repair costs a call |
| Drop the grounding checks entirely | Rejected: the model could invent dates, which breaks "only Radha computes" |
