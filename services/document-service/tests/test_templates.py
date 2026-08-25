import os

os.environ["DOCUMENT_SERVICE_KEY"] = "test-key"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.main as main
from app.models import Base, Template, TemplateTableConfig

client = TestClient(main.app)
AUTH_HEADERS = {"X-Service-Key": "test-key"}


def test_template_table_config_defaults():
    table = TemplateTableConfig.__table__

    assert table.c.row_height_min.default.arg == 18
    assert table.c.row_height_max.default.arg == 28
    assert table.c.min_rows_last_page.default.arg == 2
    assert table.c.stretch_strategy.default.arg == "end_bias"


def test_templates_returns_empty_list_without_database_url(monkeypatch):
    monkeypatch.delenv("DOCUMENT_DATABASE_URL", raising=False)

    response = client.get("/v1/templates", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json() == []


def test_templates_queries_configured_database(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Template.__table__.create(engine)
    with Session(engine) as session:
        session.add(
            Template(
                name="Phiếu nhập kho",
                version="1.0",
                page_size="A4",
                orientation="portrait",
                margin_top=20,
                margin_right=15,
                margin_bottom=20,
                margin_left=15,
            )
        )
        session.commit()

    monkeypatch.setenv("DOCUMENT_DATABASE_URL", "sqlite://")
    monkeypatch.setattr(main, "get_session", lambda: Session(engine))

    response = client.get("/v1/templates", headers=AUTH_HEADERS)

    assert response.status_code == 200
    template = response.json()[0]
    assert template == {
        "id": 1,
        "name": "Phiếu nhập kho",
        "version": "1.0",
        "file_path": None,
        "page_size": "A4",
        "orientation": "portrait",
        "margin_top": 20.0,
        "margin_right": 15.0,
        "margin_bottom": 20.0,
        "margin_left": 15.0,
        "status": "draft",
        "created_at": template["created_at"],
    }
    assert template["created_at"]


def test_templates_maps_database_failure_to_502(monkeypatch):
    def fail_session():
        raise RuntimeError("database unavailable")

    monkeypatch.setenv("DOCUMENT_DATABASE_URL", "postgresql+psycopg://invalid")
    monkeypatch.setattr(main, "get_session", fail_session)

    response = client.get("/v1/templates", headers=AUTH_HEADERS)

    assert response.status_code == 502
    assert response.json() == {
        "error": {
            "code": "DATABASE_UNAVAILABLE",
            "message": "Không thể kết nối cơ sở dữ liệu tài liệu",
        }
    }


def test_templates_requires_service_key(monkeypatch):
    monkeypatch.delenv("DOCUMENT_DATABASE_URL", raising=False)

    response = client.get("/v1/templates")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
