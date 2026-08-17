import os

os.environ["DOCUMENT_SERVICE_KEY"] = "test-key"

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_pagination_plan_ok():
    r = client.post(
        "/v1/pagination/plan",
        headers={"X-Service-Key": "test-key"},
        json={
            "n_rows": 3,
            "page_content_height": 200,
            "header_height": 20,
            "signature_block_height": 40,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["strategy"] == "end_bias"
    assert len(body["pages"]) >= 1


def test_pagination_plan_unauthorized():
    r = client.post(
        "/v1/pagination/plan",
        json={"n_rows": 3, "page_content_height": 200},
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


def test_pagination_plan_value_error():
    r = client.post(
        "/v1/pagination/plan",
        headers={"X-Service-Key": "test-key"},
        json={
            "n_rows": 50,
            "page_content_height": 40,
            "header_height": 30,
            "signature_block_height": 20,
        },
    )
    assert r.status_code == 400
    body = r.json()
    assert body["error"]["code"] == "BAD_REQUEST"
    assert "không" in body["error"]["message"]
