# -*- coding: UTF-8 -*-
"""HTTP contract for the reading-engine export types (same endpoint, new ``type`` values)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from jhora.api import app
from jhora.export import _export_api_last_mono_by_client


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    _export_api_last_mono_by_client.clear()
    yield
    _export_api_last_mono_by_client.clear()


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


GOLDEN = {"dob": "2002-04-27", "tob": "17:05:00", "lat": 28.9167, "lon": 77.0167, "tz": 5.5, "ayanamsa": "TRUE_CITRA"}


def test_facts_type(client):
    r = client.post("/api/export-horoscope", json={**GOLDEN, "type": "facts", "as_of": "2026-10-24", "vargas": ["D1", "D9", "D10"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["type"] == "facts"
    d = body["data"]
    assert d["v"] == 1 and d["as_of"] == "2026-10-24"
    assert set(d["vargas"].keys()) == {"D1", "D9", "D10"}
    assert d["birth"]["lat"] == 28.9167 and d["birth"]["tz"] == 5.5
    assert d["houses"]["10"]["lord"] == "Me"


def test_facts_with_place_returns_resolved_coordinates(client):
    r = client.post("/api/export-horoscope", json={"dob": "1990-05-10", "tob": "10:00:00", "place": "Chennai, IN", "type": "facts", "vargas": ["D1"]})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["birth"]["lat"] == pytest.approx(13.0827) and d["birth"]["lon"] == pytest.approx(80.2707) and d["birth"]["tz"] == 5.5
    assert d["birth"]["place"]


def test_natal_points_type(client):
    r = client.post("/api/export-horoscope", json={**GOLDEN, "type": "natal_points"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["v"] == 1 and "Ju" in d["points"] and "AL" in d["arudha_signs"]
    assert d["place"]["lat"] == 28.9167


def test_transits_type_without_birth_data(client):
    r = client.post("/api/export-horoscope", json={"type": "transits", "from": "2026-10-24", "to": "2026-12-31", "lat": 28.9167, "lon": 77.0167, "tz": 5.5})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["from"] == "2026-10-24" and d["to"] == "2026-12-31"
    assert d["positions"][0]["date"] == "2026-10-24"
    assert any(i["planet"] == "Ke" for i in d["ingresses"]) or any(i["planet"] == "Su" for i in d["ingresses"])


def test_transits_requires_range(client):
    r = client.post("/api/export-horoscope", json={"type": "transits"})
    assert r.status_code == 400
    assert "from" in r.json()["detail"]


def test_facts_requires_birth_data(client):
    r = client.post("/api/export-horoscope", json={"type": "facts", "place": "Chennai, IN"})
    assert r.status_code == 400


def test_legacy_types_still_work(client):
    r = client.post("/api/export-horoscope", json={**GOLDEN, "type": "d1"})
    assert r.status_code == 200, r.text
    assert r.json()["type"] == "d1" and isinstance(r.json()["data"], list)
