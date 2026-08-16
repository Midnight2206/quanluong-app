import os

os.environ["EXCEL_SERVICE_KEY"] = "test-key"

import app.main as main
from fastapi.testclient import TestClient

from app.export import export_xlsx

client = TestClient(main.app)


def test_health_no_key():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_parse_unauthorized():
    raw = export_xlsx("S", [["a"]])
    r = client.post(
        "/v1/parse",
        files={
            "file": (
                "t.xlsx",
                raw,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert r.status_code == 401
    body = r.json()
    assert body["error"]["code"] == "UNAUTHORIZED"
    assert "detail" not in body


def test_parse_rejects_xls():
    r = client.post(
        "/v1/parse",
        headers={"X-Service-Key": "test-key"},
        files={"file": ("legacy.xls", b"not-xlsx", "application/vnd.ms-excel")},
    )
    assert r.status_code == 400
    body = r.json()
    assert body["error"]["code"] == "INVALID_FORMAT"
    assert "detail" not in body


def test_parse_rejects_non_xlsx_filename():
    r = client.post(
        "/v1/parse",
        headers={"X-Service-Key": "test-key"},
        files={"file": ("notes.txt", b"not-xlsx", "text/plain")},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_FORMAT"


def test_validation_error_uses_bad_request_envelope():
    r = client.post("/v1/parse", headers={"X-Service-Key": "test-key"})
    assert r.status_code == 400
    body = r.json()
    assert body["error"]["code"] == "BAD_REQUEST"
    assert isinstance(body["error"]["message"], str)
    assert "detail" not in body


def test_parse_runs_workbook_processing_in_threadpool(monkeypatch):
    calls = []

    async def fake_run_in_threadpool(func, *args, **kwargs):
        calls.append((func, args, kwargs))
        return {"sheet": "S", "sheets": ["S"], "rows": []}

    monkeypatch.setattr(main, "run_in_threadpool", fake_run_in_threadpool, raising=False)
    r = client.post(
        "/v1/parse",
        headers={"X-Service-Key": "test-key"},
        files={
            "file": (
                "t.xlsx",
                export_xlsx("S", [["a"]]),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert r.status_code == 200
    assert len(calls) == 1
    assert calls[0][0] is main.parse_xlsx
    assert isinstance(calls[0][1][0], bytes)
    assert calls[0][2] == {"sheet": None}


def test_parse_ok():
    raw = export_xlsx("S", [["a", "b"]])
    r = client.post(
        "/v1/parse",
        headers={"X-Service-Key": "test-key"},
        files={
            "file": (
                "t.xlsx",
                raw,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert r.status_code == 200
    assert r.json()["rows"][0]["c"] == ["a", "b"]


def test_export_ok():
    r = client.post(
        "/v1/export",
        headers={"X-Service-Key": "test-key"},
        json={"sheet": "Out", "rows": [["x"], [1]]},
    )
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers["content-type"]
