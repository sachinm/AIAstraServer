# -*- coding: UTF-8 -*-
"""
Local stand-in for the pyjhora Lambda's `facts` / `transits` exports (nothing in the Radha repo is modified).

Reads a JSON list of birth inputs written by `scripts/backfill-local-facts.ts --export`, computes for each kundli
the facts.v1 dossier and the natal-overlay transit chart with pyjhora (via the parked drafts), and writes
`<kundliId>.facts.json` and `<kundliId>.transits.json` into the output folder for `--import`.

  set PYTHONPATH=C:\\Users\\Owner\\Documents\\work\\AIAstra_Radha\\src;docs\\reading-engine\\drafts\\radha
  python docs/reading-engine/drafts/radha/build_from_inputs.py <inputs.json> <out_dir> <as_of YYYY-MM-DD> [months=24]

Inputs: [{"kundliId", "dob": "YYYY-MM-DD", "tob": "HH:MM:SS", "lat", "lon", "tz", "place"}]. Ayanamsa LAHIRI.
"""
import importlib.util
import json
import logging
import os
import sys
import time
import traceback
from datetime import date

import jhora  # noqa: F401  (Radha checkout on PYTHONPATH)

HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name: str):
    spec = importlib.util.spec_from_file_location("jhora." + name, os.path.join(HERE, name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["jhora." + name] = mod
    spec.loader.exec_module(mod)
    setattr(jhora, name, mod)
    return mod


facts = _load("facts")
transits = _load("transits")
sys.path.insert(0, HERE)
from transit_chart import build_transit_chart  # noqa: E402

logging.basicConfig(level=logging.ERROR)


def add_months(iso: str, months: int) -> str:
    d = date.fromisoformat(iso)
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    day = min(d.day, [31, 29 if y % 4 == 0 and (y % 100 != 0 or y % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])
    return date(y, m, day).isoformat()


def main() -> int:
    inputs_path, out_dir, as_of = sys.argv[1], sys.argv[2], sys.argv[3]
    months = int(sys.argv[4]) if len(sys.argv) > 4 else 24
    to = add_months(as_of, months)
    os.makedirs(out_dir, exist_ok=True)
    with open(inputs_path, encoding="utf-8") as f:
        rows = json.load(f)
    snaps = {}  # the sky does not depend on the birth place; the timezone sets the date boundaries, so cache per tz
    ok = failed = 0
    for r in rows:
        kid = r["kundliId"]
        t0 = time.perf_counter()
        try:
            natal = facts.build_facts(r["dob"], r["tob"], r["lat"], r["lon"], r["tz"], r.get("place") or "Unknown", "LAHIRI", as_of)
            natal["engine"]["commit"] = "local-drafts-" + natal["engine"].get("commit", "unknown")[:12]
            tz_key = round(float(r["tz"]), 2)
            if tz_key not in snaps:
                snaps[tz_key] = transits.build_transits(as_of, to, r["lat"], r["lon"], r["tz"], "LAHIRI")
            chart = build_transit_chart(natal, snaps[tz_key], as_of)
            with open(os.path.join(out_dir, kid + ".facts.json"), "w", encoding="utf-8", newline="\n") as f:
                json.dump(natal, f, sort_keys=True, separators=(",", ":"))
            with open(os.path.join(out_dir, kid + ".transits.json"), "w", encoding="utf-8", newline="\n") as f:
                json.dump(chart, f, sort_keys=True, separators=(",", ":"))
            ok += 1
            print(json.dumps({"kundliId": kid[:8], "status": "ok", "ms": round((time.perf_counter() - t0) * 1000)}), flush=True)
        except Exception as e:  # keep going; the import step reports failures per kundli
            failed += 1
            with open(os.path.join(out_dir, kid + ".error.txt"), "w", encoding="utf-8") as f:
                f.write(traceback.format_exc())
            print(json.dumps({"kundliId": kid[:8], "status": "failed", "error": str(e)[:200]}), flush=True)
    print(json.dumps({"done": True, "ok": ok, "failed": failed, "from": as_of, "to": to}), flush=True)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
