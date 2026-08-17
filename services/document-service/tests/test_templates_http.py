import os
from io import BytesIO

os.environ["DOCUMENT_SERVICE_KEY"] = "test-key"

from fastapi.testclient import TestClient
from openpyxl import load_workbook
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


def test_create_template_returns_201_and_persists_metadata(monkeypatch):
    engine = _database(monkeypatch)

    response = _upload()

    assert response.status_code == 201
    assert response.json() == {
        "id": 1,
        "name": "Phiếu nhập",
        "version": "1",
        "file_path": None,
    }
    with Session(engine) as session:
        assert session.query(TemplateField).count() == 2
        assert session.query(TemplateTableConfig).count() == 1


def test_create_template_rejects_duplicate_name_and_version(monkeypatch):
    _database(monkeypatch)
    assert _upload().status_code == 201

    response = _upload()

    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "TEMPLATE_EXISTS",
            "message": "Mẫu «Phiếu nhập» phiên bản «1» đã tồn tại",
        }
    }


def test_create_template_maps_structure_error_to_template_invalid(monkeypatch):
    _database(monkeypatch)
    workbook = load_workbook(BytesIO(make_minimal_template()))
    del workbook.defined_names["TABLE_HEADER"]
    output = BytesIO()
    workbook.save(output)

    response = _upload(content=output.getvalue())

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "TEMPLATE_INVALID"


def test_create_template_requires_service_key():
    response = client.post("/v1/templates")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_create_template_rejects_bad_input_before_parsing(monkeypatch):
    _database(monkeypatch)

    response = _upload(filename="template.xls", name=" ")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "BAD_REQUEST"


def test_create_template_rejects_file_over_five_megabytes(monkeypatch):
    _database(monkeypatch)

    response = _upload(content=b"x" * (main.MAX_UPLOAD + 1))

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "BAD_REQUEST"


def test_create_template_runs_import_in_threadpool(monkeypatch):
    _database(monkeypatch)
    calls = []

    async def fake_run_in_threadpool(func, *args, **kwargs):
        calls.append((func, args, kwargs))
        return 9

    monkeypatch.setattr(main, "run_in_threadpool", fake_run_in_threadpool)

    response = _upload()

    assert response.status_code == 201
    assert response.json()["id"] == 9
    assert calls[0][0] is main.import_template


def test_get_template_returns_item_with_created_at(monkeypatch):
    _database(monkeypatch)
    template_id = _upload().json()["id"]

    response = client.get(f"/v1/templates/{template_id}", headers=AUTH_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "id": template_id,
        "name": "Phiếu nhập",
        "version": "1",
        "file_path": None,
        "page_size": body["page_size"],
        "orientation": body["orientation"],
        "margin_top": body["margin_top"],
        "margin_right": body["margin_right"],
        "margin_bottom": body["margin_bottom"],
        "margin_left": body["margin_left"],
        "created_at": body["created_at"],
    }
    assert body["created_at"]


def test_get_template_returns_404_when_missing(monkeypatch):
    _database(monkeypatch)

    response = client.get("/v1/templates/999", headers=AUTH_HEADERS)

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "NOT_FOUND", "message": main.NOT_FOUND_MESSAGE},
    }


def test_get_template_requires_service_key():
    response = client.get("/v1/templates/1")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_get_template_fields_returns_form_schema(monkeypatch):
    _database(monkeypatch)
    template_id = _upload().json()["id"]

    response = client.get(
        f"/v1/templates/{template_id}/fields", headers=AUTH_HEADERS
    )

    assert response.status_code == 200
    body = response.json()
    assert [field["field_name"] for field in body["fields"]] == [
        "don_vi",
        "ngay_thang",
    ]
    assert all(set(field) == {"field_name", "cell_ref"} for field in body["fields"])
    assert [column["key"] for column in body["columns"]] == [
        "stt",
        "ten_hang",
        "dvt",
        "so_luong",
        "ghi_chu",
    ]
    assert all(
        set(column) == {"key", "title", "align_h"} for column in body["columns"]
    )


def test_get_template_fields_returns_404_when_missing(monkeypatch):
    _database(monkeypatch)

    response = client.get("/v1/templates/999/fields", headers=AUTH_HEADERS)

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "NOT_FOUND", "message": main.NOT_FOUND_MESSAGE},
    }


def test_get_template_fields_requires_service_key():
    response = client.get("/v1/templates/1/fields")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
