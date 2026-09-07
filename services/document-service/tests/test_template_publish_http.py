import os

os.environ["DOCUMENT_SERVICE_KEY"] = "test-key"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.main as main
from app.models import Template, TemplateField, TemplateTableConfig
from conftest import make_minimal_template

client = TestClient(main.app)
AUTH_HEADERS = {"X-Service-Key": "test-key"}
XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _database(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in (Template, TemplateField, TemplateTableConfig):
        table.__table__.create(engine)
    monkeypatch.setenv("DOCUMENT_DATABASE_URL", "sqlite://")
    monkeypatch.setattr(main, "get_session", lambda: Session(engine))
    return engine


def _upload(*, name="Phiếu nhập", version="1"):
    return client.post(
        "/v1/templates",
        headers=AUTH_HEADERS,
        data={"name": name, "version": version},
        files={
            "file": ("template.xlsx", make_minimal_template(), XLSX_TYPE),
        },
    )


def _publish(template_id: int):
    return client.post(f"/v1/templates/{template_id}/publish", headers=AUTH_HEADERS)


def _retire(template_id: int):
    return client.post(f"/v1/templates/{template_id}/retire", headers=AUTH_HEADERS)


def test_publish_draft_then_second_publish_409(monkeypatch):
    _database(monkeypatch)
    template_id = _upload().json()["id"]

    first = _publish(template_id)
    second = _publish(template_id)

    assert first.status_code == 200
    assert first.json()["status"] == "published"
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "TEMPLATE_NOT_DRAFT"


def test_retire_published_then_second_retire_409(monkeypatch):
    _database(monkeypatch)
    template_id = _upload().json()["id"]
    assert _publish(template_id).status_code == 200

    first = _retire(template_id)
    second = _retire(template_id)

    assert first.status_code == 200
    assert first.json()["status"] == "retired"
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "TEMPLATE_ALREADY_RETIRED"


def test_list_templates_filters_by_status(monkeypatch):
    _database(monkeypatch)
    draft_id = _upload(name="Phiếu nhập", version="1").json()["id"]
    published_id = _upload(name="Phiếu xuất", version="1").json()["id"]
    retired_id = _upload(name="Biên bản", version="1").json()["id"]
    assert _publish(published_id).status_code == 200
    assert _retire(retired_id).status_code == 200

    response = client.get("/v1/templates?status=draft", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [draft_id]
    assert [item["status"] for item in response.json()] == ["draft"]


def test_list_templates_rejects_invalid_status_filter(monkeypatch):
    _database(monkeypatch)
    _upload()

    response = client.get("/v1/templates?status=archived", headers=AUTH_HEADERS)

    assert response.status_code == 400
    assert response.json() == {
        "error": {"code": "BAD_REQUEST", "message": "status không hợp lệ"},
    }
