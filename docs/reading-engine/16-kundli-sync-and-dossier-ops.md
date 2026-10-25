# 16 — Kundli sync, dossiers and transit charts: where the data comes from and how to operate it

Added 2026-10-25. Records what was done to the live database on 2026-10-24/25 and the rules that now apply.

## 1. The rule (Sachin, 2026-10-25)

- Node and the API Lambda compute nothing astrological.
- Every chart, divisional chart, dasha, strength, nakshatra and **transit chart** comes from the Radha (pyjhora) Lambda `aiastra-pyjhora`.
- If Radha answers with an error because it does not build that export yet (today: `facts` and `transits`), that is the state of things until the Radha work is done. Do not build those exports any other way.
- English only for questions and answers for now.

## 2. What Radha serves today

| Export type | Served | Stored in |
|---|---|---|
| biodata, d1, d2, d4, d7, d9, d10, charakaraka, vimsottari_dasa, narayana_dasa | yes | `kundlis` JSON columns (legacy sync) |
| facts (chart-facts dossier, docs/reading-engine/03 and 09-lambda-contract) | no: `validation_error … Input should be 'biodata', 'd1', … 'narayana_dasa'` | `kundli_facts` |
| transits (per-kundli natal-overlay transit chart) | no, same error | `transit_snapshots` |

Radha also enforces **one export request per second per client** (HTTP 429 `rate_limit` otherwise). The server's export throttle applies to every call.

## 3. State of the live database (2026-10-25)

| Kundlis | Legacy data (Radha) | Dossier | Transit chart |
|---|---|---|---|
| 24 | complete | present, built 2026-10-24 by the local stand-in (section 5) | present, same |
| 1 (`130e0c3e…`, New Delhi) | complete since 2026-10-25 (section 4) | `facts_status = failed`: Radha rejected `facts` | none |

Reading migrations M1 to M4 were applied on 2026-10-24 (QA-LIST P1-13).

## 4. The 25th kundli: why it was stuck and what fixed it

- **Symptom:** `queue_status = in_progress` since 7 Oct 2026, no biodata, no charts.
- **Cause:**
  - The sync sends only the place name ("New_Delhi, IN"), and Radha's geocoder now returns no result for it ("Place resolution failed: geocoder returned no result"). Four earlier Delhi kundlis had resolved fine.
  - The run died mid-way and left the row `in_progress`.
  - The EventBridge rule `aiastra-kundli-worker-5m` that would retry is disabled for cost, so nothing retried.
- **Fix (code, branch `fix/kundli-sync-coords`, merged into develop):**
  - The sync sends the kundli's stored `lat`, `lon` and `tz` when they exist, so Radha skips geocoding.
  - The export throttle always applies. Skipping it caused 429s.
  - Engine errors now keep Radha's `detail` text in the logged message.
- **Fix (data):**
  - Coordinates copied to this kundli from the four Delhi kundlis Radha had already resolved (28.6, 77.2, +5.5).
  - Row reset from `in_progress` to `pending`, then `scripts/run-queue-once.ts` run once with `ASTROKUNDLI_TRANSPORT=lambda` against `aiastra-pyjhora`. All ten legacy fields filled, `queue_status = completed`.
- **Then:** `facts` was requested from Radha for it. Radha rejected the type, so `facts_status = failed`. Per section 1, that is where it stays until Radha serves `facts` and `transits`.

### Re-running a stuck kundli

```bash
# 1. reset the one row (only when it is stuck in in_progress)
#    UPDATE kundlis SET queue_status='pending', queue_started_at=NULL WHERE id='<id>' AND queue_status='in_progress';
# 2. run the queue once through the Radha Lambda (needs AI Astra account credentials)
ASTROKUNDLI_TRANSPORT=lambda ASTROKUNDLI_LAMBDA_FUNCTION_NAME=aiastra-pyjhora ASTROKUNDLI_LAMBDA_REGION=us-east-1 NODE_ENV=staging npx tsx scripts/run-queue-once.ts
```

If the place does not geocode, set `lat`, `lon` and `tz` on the kundli first. Use values Radha itself resolved for the same place on another kundli, or the place's published coordinates.

## 5. The 24 dossiers and transit charts built on 2026-10-24 (stand-in)

Before the rule in section 1 was stated this strictly, the 24 existing dossiers and transit charts were computed on a development machine. The computation used pyjhora (the same library Radha runs) through the parked drafts in `docs/reading-engine/drafts/radha/`. The tools are `scripts/backfill-local-facts.ts` and `drafts/radha/build_from_inputs.py`:

1. Export: birth date and time from `auth`, coordinates and timezone from each kundli's stored Radha biodata (the timezone sign restored from longitude, AF-12).
2. Compute with pyjhora: facts.v1 dossier and a two-year natal-overlay transit chart (2026-10-24 to 2028-10-24), Lahiri.
3. Validate against `facts.v1.schema.json` and `transits.v1.schema.json` (all 24 valid).
4. Cross-check against each kundli's Radha D-1: Lagna and all nine grahas in the same sign for all 24; largest longitude difference 0.015°.
5. Store in `kundli_facts` (engine commit marked `local-drafts-…`) and `transit_snapshots`; `facts_status = ready`.

Evidence: `docs/screenshots/p1-14-facts-backfill/`, QA-LIST P1-14. Under the rule in section 1, these tools are not to be used again. **Decision (Sachin, 2026-10-25): keep the 24 stored dossiers and transit charts for now; build no more.** They are identifiable by `kundli_facts.engine_commit LIKE 'local-drafts-%'` and by `transit_snapshots` rows created on 2026-10-24/25.

## 6. What the chat path does with this data

- The reading engine is the default chat path (`READING_ENGINE=0` is the kill switch).
- With a dossier: intake, bucket classification, evidence pack, one streamed answer.
- Without a dossier: the reply says the chart is still being prepared, and a Radha `facts` build is scheduled. Today that build fails, so the reply stays the same until Radha serves `facts`.
- Legacy fallback only with `READING_FALLBACK_LEGACY=1` (emergency switch).
- Production runs this only after `develop` is deployed with the "Deploy API Lambda (OIDC)" workflow. As of this writing, that deploy has not run.

## 7. What unblocks the rest

| Need | Owner | Where |
|---|---|---|
| Radha `facts` and `transits` exports | Sachin's Radha pass | `docs/reading-engine/09-lambda-contract.md` |
| Re-enable a retry for stuck syncs (EventBridge rule or a startup sweep) | decision: cost vs reliability | `aiastra-aws-terraform`; or a sweep that resets rows `in_progress` for more than 30 minutes |
| Geocoding reliability | Radha (built-in city table or coordinates from the web registration form) | docs/product/auth-registration-review.md (place fields with country/state/city) |
