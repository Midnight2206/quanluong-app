import os
from io import BytesIO
from urllib.parse import quote

os.environ["DOCUMENT_SERVICE_KEY"] = "test-key"

import pytest
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


def _create_document(template_id, *, fields=None, rows=None):
    return client.post(
        f"/v1/templates/{template_id}/documents",
        headers=AUTH_HEADERS,
        json={
            "fields": fields or {},
            "rows": rows if rows is not None else [],
        },
    )


def _publish(template_id):
    return client.post(f"/v1/templates/{template_id}/publish", headers=AUTH_HEADERS)


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
        "status": "draft",
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
    assert all(
        set(field) == {"field_name", "cell_ref", "named_range"}
        for field in body["fields"]
    )
    assert [field["named_range"] for field in body["fields"]] == [
        "FIELD_don_vi",
        "FIELD_ngay_thang",
    ]
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
    assert body["signature_block"]["columns"] == 2
    assert body["signature_block"]["gap_pt"] == 40
    assert body["signature_block"]["date_line_gap_pt"] == 14
    assert [slot["key"] for slot in body["signature_block"]["slots"]] == [
        "nguoi_lap",
        "thu_truong",
    ]
    assert all(
        set(slot)
        == {
            "key",
            "label",
            "col",
            "col_span",
            "source",
            "static_name",
            "show_date_line",
        }
        for slot in body["signature_block"]["slots"]
    )


def test_get_template_fields_returns_404_when_missing(monkeypatch):
    _database(monkeypatch)

    response = client.get("/v1/templates/999/fields", headers=AUTH_HEADERS)

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "NOT_FOUND", "message": main.NOT_FOUND_MESSAGE},
    }


def test_get_template_fields_returns_404_without_table_config(monkeypatch):
    engine = _database(monkeypatch)
    template_id = _upload().json()["id"]
    with Session(engine) as session:
        session.query(TemplateTableConfig).delete()
        session.commit()

    response = client.get(
        f"/v1/templates/{template_id}/fields", headers=AUTH_HEADERS
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_get_template_fields_requires_service_key():
    response = client.get("/v1/templates/1/fields")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_create_document_renders_three_rows_as_pdf(monkeypatch):
    _database(monkeypatch)
    template_id = _upload().json()["id"]
    assert _publish(template_id).status_code == 200

    response = _create_document(
        template_id,
        fields={"don_vi": "Bếp ăn"},
        rows=[
            {"stt": "1", "ten_hang": "Gạo"},
            {"stt": "2", "ten_hang": "Muối"},
            {"stt": "3", "ten_hang": "Dầu"},
        ],
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_create_document_silently_ignores_extra_row_keys(monkeypatch):
    _database(monkeypatch)
    template_id = _upload().json()["id"]
    assert _publish(template_id).status_code == 200

    response = _create_document(
        template_id,
        rows=[{"stt": "1", "ten_hang": "Gạo", "future_client_key": "ignored"}],
    )

    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")


def test_create_document_returns_404_when_template_missing(monkeypatch):
    _database(monkeypatch)

    response = _create_document(999)

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "NOT_FOUND", "message": main.NOT_FOUND_MESSAGE},
    }


def test_create_document_returns_404_without_table_config(monkeypatch):
    engine = _database(monkeypatch)
    template_id = _upload().json()["id"]
    assert _publish(template_id).status_code == 200
    with Session(engine) as session:
        session.query(TemplateTableConfig).delete()
        session.commit()

    response = _create_document(template_id)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_create_document_returns_409_when_template_not_published(monkeypatch):
    _database(monkeypatch)
    template_id = _upload().json()["id"]

    response = _create_document(template_id)

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "TEMPLATE_NOT_PUBLISHED",
            "message": "Chỉ mẫu đã publish mới được render PDF",
        }
    }


@pytest.mark.parametrize("rows", [{"stt": "1"}, ["not an object"]])
def test_create_document_rejects_bad_rows_type(monkeypatch, rows):
    _database(monkeypatch)

    response = client.post(
        "/v1/templates/1/documents",
        headers=AUTH_HEADERS,
        json={"fields": {}, "rows": rows},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "BAD_REQUEST"


def test_create_document_uses_rfc5987_filename_for_vietnamese_name(monkeypatch):
    _database(monkeypatch)
    name = "Phiếu nhập"
    version = "bản 1"
    template_id = _upload(name=name, version=version).json()["id"]
    assert _publish(template_id).status_code == 200

    response = _create_document(template_id)

    encoded_name = quote(f"{name}-{version}", safe="")
    assert response.headers["content-disposition"] == (
        f'attachment; filename="document.pdf"; '
        f"filename*=UTF-8''{encoded_name}.pdf"
    )


def test_create_document_maps_pagination_failure_verbatim(monkeypatch):
    engine = _database(monkeypatch)
    template_id = _upload().json()["id"]
    assert _publish(template_id).status_code == 200
    with Session(engine) as session:
        table = session.query(TemplateTableConfig).one()
        table.row_height_min = 1000
        table.row_height_max = 1000
        session.commit()

    response = _create_document(template_id, rows=[{"stt": "1"}])

    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "PAGINATION_FAILED",
            "message": "Phân trang không khả thi với giới hạn chiều cao dòng đã cho",
        },
    }


def test_create_document_maps_other_render_value_error_to_bad_request(monkeypatch):
    _database(monkeypatch)
    template_id = _upload().json()["id"]
    assert _publish(template_id).status_code == 200

    def fail_render(**_kwargs):
        raise ValueError("Dữ liệu render không hợp lệ")

    monkeypatch.setattr(main, "render_pdf", fail_render)

    response = _create_document(template_id)

    assert response.status_code == 400
    assert response.json() == {
        "error": {"code": "BAD_REQUEST", "message": "Dữ liệu render không hợp lệ"},
    }


def test_create_document_runs_render_in_threadpool(monkeypatch):
    _database(monkeypatch)
    template_id = _upload().json()["id"]
    assert _publish(template_id).status_code == 200
    calls = []

    async def fake_run_in_threadpool(func, *args, **kwargs):
        calls.append((func, args, kwargs))
        return b"%PDF fake"

    monkeypatch.setattr(main, "run_in_threadpool", fake_run_in_threadpool)

    response = _create_document(template_id)

    assert response.status_code == 200
    assert calls == [
        (
            main.render_pdf,
            (),
            {
                "metadata": calls[0][2]["metadata"],
                "fields": {},
                "rows": [],
                "signatures": {},
                "signature_dates": {},
            },
        )
    ]
