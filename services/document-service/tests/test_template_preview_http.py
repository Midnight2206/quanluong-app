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
    monkeypatch.setattr(main, "get_session", lambda: Session(engine))
    return engine


def _upload(*, content=None, filename="template.xlsx", name="Phiếu nhập", version="1"):
    return client.post(
        "/v1/templates",
        headers=AUTH_HEADERS,
        data={"name": name, "version": version},
        files={"file": (filename, content or make_minimal_template(), XLSX_TYPE)},
    )


def test_preview_template_returns_inline_pdf(monkeypatch):
    _database(monkeypatch)
    template_id = _upload().json()["id"]

    response = client.get(f"/v1/templates/{template_id}/preview", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"] == (
        f'inline; filename="preview-{template_id}.pdf"'
    )
    assert response.content.startswith(b"%PDF")
