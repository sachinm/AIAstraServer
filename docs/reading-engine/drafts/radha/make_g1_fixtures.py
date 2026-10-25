# -*- coding: UTF-8 -*-
"""
DRAFT (parked). Regenerates the G1 golden fixtures that stand in for the pyjhora Lambda until it serves `facts` / `transits`.

Run from AIAstra_Server with the Radha checkout on the path (nothing in Radha is modified):

  set PYTHONPATH=C:\\Users\\Owner\\Documents\\work\\AIAstra_Radha\\src;docs\\reading-engine\\drafts\\radha
  python docs/reading-engine/drafts/radha/make_g1_fixtures.py [LAHIRI|TRUE_CITRA]

Default ayanamsa LAHIRI: it is what the Node server already requests for the legacy exports, so the Charts page, the legacy
chat context and the dossier agree.
"""
import json
import logging
import sys

import importlib.util
import os

import jhora  # noqa: F401  (Radha checkout on PYTHONPATH)


def _load_as_jhora_submodule(name: str):
    """Load a parked draft file as `jhora.<name>` without copying anything into the Radha repo."""
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location("jhora." + name, os.path.join(here, name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["jhora." + name] = mod
    spec.loader.exec_module(mod)
    setattr(jhora, name, mod)
    return mod


facts = _load_as_jhora_submodule("facts")
transits = _load_as_jhora_submodule("transits")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from transit_chart import build_transit_chart

AYANAMSA = sys.argv[1] if len(sys.argv) > 1 else "LAHIRI"
AS_OF = "2026-10-24"
logging.basicConfig(level=logging.ERROR)

natal = facts.build_facts("2002-04-27", "17:05:00", 28.9167, 77.0167, 5.5, "South Grafton, India", AYANAMSA, AS_OF)
natal["engine"]["commit"] = "draft-stand-in"
snap = transits.build_transits(AS_OF, "2028-10-24", 28.9167, 77.0167, 5.5, AYANAMSA)
chart = build_transit_chart(natal, snap, AS_OF)

def dump(path, obj):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, indent=1, sort_keys=True)
        f.write("\n")

dump("evals/fixtures/G1/facts.v1.json", natal)
dump("evals/fixtures/G1/transits.v1.json", chart)
cur = natal["dasha"]["vimshottari"]["current"]
print("ayanamsa", AYANAMSA, "running", cur.get("md"), cur.get("ad"), cur.get("pd"), cur.get("ad_start"), cur.get("ad_end"), cur.get("pd_start"), cur.get("pd_end"))
print("Sa MD", [m for m in natal["dasha"]["vimshottari"]["mahadashas"] if m["md"] == "Sa"])
