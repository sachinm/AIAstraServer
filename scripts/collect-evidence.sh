#!/usr/bin/env bash
# Regenerates the evidence files for the Phase 1 tests that need no browser (TEST.MD ids P1-01 … P1-04, P1-10 copies).
# Run from the repo root: bash scripts/collect-evidence.sh
set -u
strip() { sed 's/\x1b\[[0-9;]*m//g'; }
S=docs/screenshots

mkdir -p $S/p1-01-unit-suites $S/p1-02-pack-sizes $S/p1-03-cache-prefix $S/p1-04-eval-harness

echo "== P1-01 unit suites"
npx vitest run tests/unit/reading 2>&1 | strip > $S/p1-01-unit-suites/01-vitest-reading.txt
npm run test:unit 2>&1 | strip | grep -E "FAIL|Test Files|Tests  " | sort -u > $S/p1-01-unit-suites/02-vitest-all-unit-summary.txt
npx tsc --noEmit > $S/p1-01-unit-suites/03-tsc-noemit.txt 2>&1; echo "exit $?" >> $S/p1-01-unit-suites/03-tsc-noemit.txt

echo "== P1-02 pack sizes"
npx tsx scripts/pack-size.ts --dump $S/p1-02-pack-sizes 2>&1 | tee $S/p1-02-pack-sizes/01-pack-sizes.txt

echo "== P1-03 cache prefix"
npx tsx scripts/cache-prefix-probe.ts $S/p1-03-cache-prefix/01-prefix-probe.json 2>&1 | strip > $S/p1-03-cache-prefix/01-prefix-probe.txt

echo "== P1-04 eval harness (fake model)"
npx tsx evals/run.ts --fake --engine phase1 --out $S/p1-04-eval-harness/phase1 2>&1 | grep -E "^(PASS|FAIL)|report:" > $S/p1-04-eval-harness/01-phase1-console.txt
npx tsx evals/run.ts --fake --engine graph --out $S/p1-04-eval-harness/graph 2>&1 | grep -E "^(PASS|FAIL)|report:" > $S/p1-04-eval-harness/02-graph-console.txt
echo EVIDENCE_DONE
