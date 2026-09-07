import os
from io import BytesIO
import zipfile

os.environ["DOCUMENT_SERVICE_KEY"] = "test-key"

from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.main as main
from app.models import Folder, FolderFile, Template, TemplateField, TemplateTableConfig
from conftest import make_minimal_template

client = TestClient(main.app)
AUTH_HEADERS = {"X-Service-Key": "test-key"}
XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _database(monkeypatch, tmp_path):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in (Template, TemplateField, TemplateTableConfig, Folder, FolderFile):
        table.__table__.create(engine)
    monkeypatch.setenv("DOCUMENT_DATABASE_URL", "sqlite://")
    monkeypatch.setenv("DOCUMENT_STORAGE_ROOT", str(tmp_path))
    monkeypatch.setattr(main, "get_session", lambda: Session(engine))
    return engine


def _upload_template():
    response = client.post(
        "/v1/templates",
        headers=AUTH_HEADERS,
        data={"name": "Phiếu nhập", "version": "1"},
        files={"file": ("template.xlsx", make_minimal_template(), XLSX_TYPE)},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _publish(template_id: int):
    return client.post(f"/v1/templates/{template_id}/publish", headers=AUTH_HEADERS)


def _create_folder(name: str = "test-batch"):
    response = client.post("/v1/folders", headers=AUTH_HEADERS, json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


def _add_document(folder_id: int, template_id: int, file_name: str, sort_key: str):
    response = client.post(
        f"/v1/folders/{folder_id}/documents",
        headers=AUTH_HEADERS,
        json={
            "template_id": template_id,
            "file_name": file_name,
            "sort_key": sort_key,
            "fields": {
                "don_vi": "Bếp ăn A",
                "ngay_thang": f"Ngày {sort_key[-2:]} tháng 06 năm 2026",
            },
            "rows": [{"stt": "1", "ten_hang": "Gạo"}],
        },
    )
    assert response.status_code == 201
    return response.json()["file_id"]


def test_create_folder_and_add_pdf(monkeypatch, tmp_path):
    _database(monkeypatch, tmp_path)
    template_id = _upload_template()
    assert _publish(template_id).status_code == 200
    folder_id = _create_folder()

    file_id = _add_document(folder_id, template_id, "2026-06-01.pdf", "2026-06-01")

    response = client.get(
        f"/v1/folders/{folder_id}/files/{file_id}", headers=AUTH_HEADERS
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
    assert (tmp_path / "folders" / str(folder_id) / "2026-06-01.pdf").is_file()


def test_get_folder_lists_files(monkeypatch, tmp_path):
    _database(monkeypatch, tmp_path)
    template_id = _upload_template()
    assert _publish(template_id).status_code == 200
    folder_id = _create_folder()

    _add_document(folder_id, template_id, "2026-06-02.pdf", "2026-06-02")
    _add_document(folder_id, template_id, "2026-06-01.pdf", "2026-06-01")

    response = client.get(f"/v1/folders/{folder_id}", headers=AUTH_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == folder_id
    assert body["name"] == "test-batch"
    assert [file["file_name"] for file in body["files"]] == [
        "2026-06-01.pdf",
        "2026-06-02.pdf",
    ]


def test_folder_zip_and_merged_pdf_return_valid_bytes(monkeypatch, tmp_path):
    _database(monkeypatch, tmp_path)
    template_id = _upload_template()
    assert _publish(template_id).status_code == 200
    folder_id = _create_folder()

    _add_document(folder_id, template_id, "2026-06-01.pdf", "2026-06-01")
    _add_document(folder_id, template_id, "2026-06-02.pdf", "2026-06-02")

    zip_response = client.get(f"/v1/folders/{folder_id}/zip", headers=AUTH_HEADERS)
    merged_response = client.get(
        f"/v1/folders/{folder_id}/merged.pdf", headers=AUTH_HEADERS
    )

    assert zip_response.status_code == 200
    assert zip_response.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(BytesIO(zip_response.content)) as archive:
        assert archive.namelist() == ["2026-06-01.pdf", "2026-06-02.pdf"]
        assert all(archive.read(name).startswith(b"%PDF") for name in archive.namelist())

    assert merged_response.status_code == 200
    assert merged_response.headers["content-type"] == "application/pdf"
    assert merged_response.content.startswith(b"%PDF")
    assert len(PdfReader(BytesIO(merged_response.content)).pages) == 2


def test_delete_folder_removes_folder(monkeypatch, tmp_path):
    engine = _database(monkeypatch, tmp_path)
    template_id = _upload_template()
    assert _publish(template_id).status_code == 200
    folder_id = _create_folder()

    _add_document(folder_id, template_id, "2026-06-01.pdf", "2026-06-01")
    folder_path = tmp_path / "folders" / str(folder_id)
    assert folder_path.is_dir()

    response = client.delete(f"/v1/folders/{folder_id}", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert not folder_path.exists()

    with Session(engine) as session:
        assert session.get(Folder, folder_id) is None
        assert session.scalars(
            select(FolderFile).where(FolderFile.folder_id == folder_id)
        ).all() == []

    get_response = client.get(f"/v1/folders/{folder_id}", headers=AUTH_HEADERS)
    assert get_response.status_code == 404


def test_add_folder_document_returns_409_when_template_not_published(monkeypatch, tmp_path):
    _database(monkeypatch, tmp_path)
    template_id = _upload_template()
    folder_id = _create_folder()

    response = client.post(
        f"/v1/folders/{folder_id}/documents",
        headers=AUTH_HEADERS,
        json={
            "template_id": template_id,
            "file_name": "2026-06-01.pdf",
            "sort_key": "2026-06-01",
            "fields": {},
            "rows": [],
        },
    )

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "TEMPLATE_NOT_PUBLISHED",
            "message": "Chỉ mẫu đã publish mới được render PDF",
        }
    }


def test_add_folder_document_prefers_not_published_over_duplicate_name(monkeypatch, tmp_path):
    _database(monkeypatch, tmp_path)
    published_id = _upload_template()
    assert _publish(published_id).status_code == 200
    draft_response = client.post(
        "/v1/templates",
        headers=AUTH_HEADERS,
        data={"name": "Phiếu xuất", "version": "1"},
        files={"file": ("template.xlsx", make_minimal_template(), XLSX_TYPE)},
    )
    assert draft_response.status_code == 201
    draft_id = draft_response.json()["id"]
    folder_id = _create_folder()
    _add_document(folder_id, published_id, "2026-06-01.pdf", "2026-06-01")

    response = client.post(
        f"/v1/folders/{folder_id}/documents",
        headers=AUTH_HEADERS,
        json={
            "template_id": draft_id,
            "file_name": "2026-06-01.pdf",
            "sort_key": "2026-06-01",
            "fields": {},
            "rows": [],
        },
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TEMPLATE_NOT_PUBLISHED"


def test_clear_folder_files_keeps_folder_removes_pdfs(monkeypatch, tmp_path):
    _database(monkeypatch, tmp_path)
    template_id = _upload_template()
    assert _publish(template_id).status_code == 200
    folder_id = _create_folder("keep-me")

    _add_document(folder_id, template_id, "a.pdf", "a")
    _add_document(folder_id, template_id, "b.pdf", "b")
    assert (tmp_path / "folders" / str(folder_id) / "a.pdf").is_file()
    assert (tmp_path / "folders" / str(folder_id) / "b.pdf").is_file()

    response = client.delete(f"/v1/folders/{folder_id}/files", headers=AUTH_HEADERS)
    assert response.status_code == 200
    body = response.json()
    assert body["folder_id"] == folder_id
    assert body["deleted_count"] == 2

    listed = client.get(f"/v1/folders/{folder_id}", headers=AUTH_HEADERS)
    assert listed.status_code == 200
    assert listed.json()["id"] == folder_id
    assert listed.json()["files"] == []
    assert not (tmp_path / "folders" / str(folder_id) / "a.pdf").exists()
    assert not (tmp_path / "folders" / str(folder_id) / "b.pdf").exists()
