# evals/baseline — Phase 0 baseline (07-evaluation §5)

**Status 2026-10-24: blocked on DB access and a Gemini key.** This machine has no server `.env`
(`DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`), no AWS profile and no `aiastra-ops` credentials, so
the current chat path cannot be exercised locally. Phase 1 continues (08-rollout Phase 0 item 6 is
recorded here rather than run).

To run the baseline once a `.env` exists:

```
npm run eval:readings -- --chart G1 --engine current --out evals/baseline
```

The runner (added in Phase 1) stores `answers.json`, `grounding.json` and `summary.md` here so the
before/after numbers for grounding, D-1 bias (Q2/Q8/Q9), latency and tokens can be compared with
`evals/reports/<date>/`.
