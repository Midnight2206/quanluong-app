import os

os.environ["EXCEL_SERVICE_KEY"] = "test-key"

from fastapi.testclient import TestClient

from app.export import export_xlsx
from app.main import app

client = TestClient(app)


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
