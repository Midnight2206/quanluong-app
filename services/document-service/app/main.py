from __future__ import annotations

import os
from dataclasses import asdict
from importlib import import_module
from typing import Optional
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool

from app.auth import require_service_key
from app.db import get_session
from app.errors import error_detail, value_error_detail
from app.export import export_xlsx
from app.folders.folder_service import (
    FolderFileNotFoundError,
    FolderNotFoundError,
    TemplateMetadataNotFoundError,
    add_folder_document,
    build_merged_pdf,
    build_zip,
    create_folder,
    delete_folder,
    get_folder,
    get_folder_file,
)
from app.models import Template
from app.pagination import PaginationError, plan_pages
from app.parse import parse_xlsx
from app.render.pdf_renderer import render_pdf
from app.render.signature_block import default_signature_block, parse_signature_block_config
from app.templates.placeholder_data import generate_placeholder_data
from app.templates.status import (
    TEMPLATE_STATUSES,
    TemplateStatusError,
    publish_template,
    retire_template,
)

_template_errors = import_module("app.import.errors")
import_template = import_module("app.import.template_service").import_template
load_metadata_from_db = import_module("app.import.metadata_store").load_metadata_from_db
seed_bien_ban_test_v2_demo = import_module(
    "app.documents.document_service"
).seed_bien_ban_test_v2_demo
seed_demo_for_template = import_module(
    "app.documents.document_service"
).seed_demo_for_template
get_document_payload = import_module(
    "app.documents.document_service"
).get_document_payload
TemplateExistsError = _template_errors.TemplateExistsError
TemplateValidationError = _template_errors.TemplateValidationError

MAX_UPLOAD = 5 * 1024 * 1024
NOT_FOUND_MESSAGE = "Không tìm thấy mẫu"

app = FastAPI()


def _template_item(template: Template) -> dict:
    return {
        "id": template.id,
        "name": template.name,
        "version": template.version,
        "file_path": template.file_path,
        "page_size": template.page_size,
        "orientation": template.orientation,
        "margin_top": template.margin_top,
        "margin_right": template.margin_right,
        "margin_bottom": template.margin_bottom,
        "margin_left": template.margin_left,
        "status": template.status,
        "created_at": template.created_at,
    }


def _database_unavailable() -> HTTPException:
    return HTTPException(
        status_code=502,
        detail=error_detail(
            "DATABASE_UNAVAILABLE",
            "Không thể kết nối cơ sở dữ liệu tài liệu",
        ),
    )


def _document_content_disposition(name: str, version: str) -> str:
    encoded_name = quote(f"{name}-{version}", safe="")
    return (
        'attachment; filename="document.pdf"; '
        f"filename*=UTF-8''{encoded_name}.pdf"
    )


def _download_content_disposition(
    file_name: str, *, fallback_name: str = "download.bin"
) -> str:
    encoded_name = quote(file_name, safe="")
    return (
        f'attachment; filename="{fallback_name}"; '
        f"filename*=UTF-8''{encoded_name}"
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail:
        body = detail
    elif isinstance(detail, dict) and "code" in detail and "message" in detail:
        body = {"error": detail}
    else:
        message = detail if isinstance(detail, str) else str(detail)
        body = {"error": {"code": "HTTP_ERROR", "message": message}}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, _exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content=error_detail("BAD_REQUEST", "Dữ liệu yêu cầu không hợp lệ"),
    )


@app.get("/health")
def health():
    return {"ok": True, "service": "document"}


@app.get("/v1/templates")
def list_templates(
    status: Optional[str] = Query(default=None), _: None = Depends(require_service_key)
):
    if status is not None and status not in TEMPLATE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=error_detail("BAD_REQUEST", "status không hợp lệ"),
        )

    if not (os.environ.get("DOCUMENT_DATABASE_URL") or "").strip():
        return []

    try:
        with get_session() as session:
            query = select(Template).order_by(Template.id)
            if status is not None:
                query = query.where(Template.status == status)
            templates = session.scalars(query).all()
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    return [_template_item(template) for template in templates]


@app.get("/v1/templates/{template_id}")
def get_template(template_id: int, _: None = Depends(require_service_key)):
    try:
        with get_session() as session:
            template = session.get(Template, template_id)
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    if template is None:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", NOT_FOUND_MESSAGE),
        )

    return _template_item(template)


@app.get("/v1/templates/{template_id}/fields")
def get_template_fields(template_id: int, _: None = Depends(require_service_key)):
    try:
        with get_session() as session:
            metadata = load_metadata_from_db(session, template_id)
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    if metadata is None:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", NOT_FOUND_MESSAGE),
        )

    return {
        "fields": [
            {"field_name": field.field_name, "cell_ref": field.cell_ref}
            for field in metadata.fields
        ],
        "columns": [
            {"key": column.key, "title": column.title, "align_h": column.align_h}
            for column in metadata.table.columns
        ],
        "signature_block": asdict(metadata.signature_block or default_signature_block()),
    }


@app.get("/v1/templates/{template_id}/preview")
async def preview_template(template_id: int, _: None = Depends(require_service_key)):
    try:
        with get_session() as session:
            metadata = load_metadata_from_db(session, template_id)
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    if metadata is None:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", NOT_FOUND_MESSAGE),
        )

    fields, rows, signatures = generate_placeholder_data(metadata)

    try:
        content = await run_in_threadpool(
            render_pdf,
            metadata=metadata,
            fields=fields,
            rows=rows,
            signatures=signatures,
        )
    except PaginationError as exc:
        raise HTTPException(
            status_code=400,
            detail=error_detail("PAGINATION_FAILED", str(exc)),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=error_detail("BAD_REQUEST", str(exc)),
        )

    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="preview-{template_id}.pdf"'},
    )


@app.post("/v1/templates/{template_id}/publish")
def publish_template_route(template_id: int, _: None = Depends(require_service_key)):
    try:
        with get_session() as session:
            template = session.get(Template, template_id)
            if template is None:
                raise HTTPException(
                    status_code=404,
                    detail=error_detail("NOT_FOUND", NOT_FOUND_MESSAGE),
                )
            payload = _template_item(publish_template(session, template))
            session.commit()
    except TemplateStatusError as exc:
        raise HTTPException(status_code=409, detail=error_detail(exc.code, str(exc)))
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    return payload


@app.post("/v1/templates/{template_id}/retire")
def retire_template_route(template_id: int, _: None = Depends(require_service_key)):
    try:
        with get_session() as session:
            template = session.get(Template, template_id)
            if template is None:
                raise HTTPException(
                    status_code=404,
                    detail=error_detail("NOT_FOUND", NOT_FOUND_MESSAGE),
                )
            payload = _template_item(retire_template(session, template))
            session.commit()
    except TemplateStatusError as exc:
        raise HTTPException(status_code=409, detail=error_detail(exc.code, str(exc)))
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    return payload


class SignatureSlotBody(BaseModel):
    key: str
    label: str = ""
    col: int = 0
    col_span: int = 1
    source: str = "dynamic"
    static_name: Optional[str] = None
    show_date_line: bool = False


class SignatureBlockBody(BaseModel):
    slots: list[SignatureSlotBody]
    columns: int = 2
    gap_pt: float = 40
    date_line_gap_pt: float = 14


class DocumentBody(BaseModel):
    fields: dict
    rows: list[dict]
    signatures: dict[str, str] = {}
    signature_dates: dict[str, str] = {}
    signature_block: Optional[SignatureBlockBody] = None


class StoredPdfBody(BaseModel):
    signatures: dict[str, str] = {}
    signature_dates: dict[str, str] = {}
    signature_block: Optional[SignatureBlockBody] = None


class FolderBody(BaseModel):
    name: str


class FolderDocumentBody(DocumentBody):
    template_id: int
    file_name: str
    sort_key: Optional[str] = None


@app.post("/v1/folders", status_code=201)
def create_folder_route(
    body: FolderBody,
    _: None = Depends(require_service_key),
):
    try:
        with get_session() as session:
            folder_id = create_folder(session, body.name)
            payload = get_folder(session, folder_id)
            session.commit()
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=error_detail("BAD_REQUEST", str(exc)),
        )
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    return {
        "id": payload["id"],
        "name": payload["name"],
        "created_at": payload["created_at"],
    }


@app.get("/v1/folders/{folder_id}")
def get_folder_route(folder_id: int, _: None = Depends(require_service_key)):
    try:
        with get_session() as session:
            payload = get_folder(session, folder_id)
    except FolderNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", str(exc)),
        )
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    return payload


@app.post("/v1/folders/{folder_id}/documents", status_code=201)
def add_folder_document_route(
    folder_id: int,
    body: FolderDocumentBody,
    _: None = Depends(require_service_key),
):
    try:
        with get_session() as session:
            payload = add_folder_document(
                session,
                folder_id,
                body.template_id,
                body.model_dump(
                    include={
                        "fields",
                        "rows",
                        "signatures",
                        "signature_dates",
                        "signature_block",
                    }
                ),
                body.file_name,
                body.sort_key,
            )
            session.commit()
    except FolderNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", str(exc)),
        )
    except TemplateMetadataNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", NOT_FOUND_MESSAGE),
        )
    except PaginationError as exc:
        raise HTTPException(
            status_code=400,
            detail=error_detail("PAGINATION_FAILED", str(exc)),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=error_detail("BAD_REQUEST", str(exc)),
        )
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    return payload


@app.get("/v1/folders/{folder_id}/files/{file_id}")
def get_folder_file_route(
    folder_id: int,
    file_id: int,
    _: None = Depends(require_service_key),
):
    try:
        with get_session() as session:
            payload = get_folder_file(session, folder_id, file_id)
    except (FolderNotFoundError, FolderFileNotFoundError) as exc:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", str(exc)),
        )
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    return FileResponse(
        payload["pdf_path"],
        media_type="application/pdf",
        filename=payload["file_name"],
    )


@app.get("/v1/folders/{folder_id}/zip")
def get_folder_zip_route(folder_id: int, _: None = Depends(require_service_key)):
    try:
        with get_session() as session:
            folder = get_folder(session, folder_id)
            content = build_zip(session, folder_id)
    except FolderNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", str(exc)),
        )
    except FolderFileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", str(exc)),
        )
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    return Response(
        content=content,
        media_type="application/zip",
        headers={
            "Content-Disposition": _download_content_disposition(
                f"{folder['name']}.zip", fallback_name="folder.zip"
            )
        },
    )


@app.get("/v1/folders/{folder_id}/merged.pdf")
def get_folder_merged_pdf_route(folder_id: int, _: None = Depends(require_service_key)):
    try:
        with get_session() as session:
            folder = get_folder(session, folder_id)
            content = build_merged_pdf(session, folder_id)
    except FolderNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", str(exc)),
        )
    except FolderFileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", str(exc)),
        )
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": _download_content_disposition(
                f"{folder['name']}.pdf", fallback_name="merged.pdf"
            )
        },
    )


@app.delete("/v1/folders/{folder_id}")
def delete_folder_route(folder_id: int, _: None = Depends(require_service_key)):
    try:
        with get_session() as session:
            delete_folder(session, folder_id)
            session.commit()
    except FolderNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", str(exc)),
        )
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    return {"ok": True}


@app.post("/v1/templates/{template_id}/documents")
async def create_document(
    template_id: int,
    body: DocumentBody,
    _: None = Depends(require_service_key),
):
    try:
        with get_session() as session:
            metadata = load_metadata_from_db(session, template_id)
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    if metadata is None:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", NOT_FOUND_MESSAGE),
        )

    if body.signature_block is not None:
        try:
            metadata.signature_block = parse_signature_block_config(
                body.signature_block.model_dump()
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=error_detail("BAD_REQUEST", str(exc)),
            )

    try:
        content = await run_in_threadpool(
            render_pdf,
            metadata=metadata,
            fields=body.fields,
            rows=body.rows,
            signatures=body.signatures,
            signature_dates=body.signature_dates,
        )
    except PaginationError as exc:
        raise HTTPException(
            status_code=400,
            detail=error_detail("PAGINATION_FAILED", str(exc)),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=error_detail("BAD_REQUEST", str(exc)),
        )

    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": _document_content_disposition(
                metadata.name, metadata.version
            )
        },
    )


@app.post("/v1/templates", status_code=201)
async def create_template(
    _: None = Depends(require_service_key),
    file: UploadFile = File(...),
    name: str = Form(...),
    version: str = Form(...),
):
    name = name.strip()
    version = version.strip()
    if not (file.filename or "").lower().endswith(".xlsx") or not name or not version:
        raise HTTPException(
            status_code=400,
            detail=error_detail("BAD_REQUEST", "Dữ liệu yêu cầu không hợp lệ"),
        )

    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(
            status_code=400,
            detail=error_detail(
                "BAD_REQUEST", f"File vượt quá {MAX_UPLOAD // (1024 * 1024)} MB"
            ),
        )

    try:
        with get_session() as session:
            template_id = await run_in_threadpool(
                import_template,
                session,
                name=name,
                version=version,
                xlsx_bytes=data,
            )
    except TemplateValidationError as exc:
        raise HTTPException(
            status_code=400,
            detail=error_detail("TEMPLATE_INVALID", str(exc)),
        )
    except TemplateExistsError as exc:
        raise HTTPException(
            status_code=400,
            detail=error_detail("TEMPLATE_EXISTS", str(exc)),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=error_detail("BAD_REQUEST", str(exc)),
        )
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    return {
        "id": template_id,
        "name": name,
        "version": version,
        "file_path": None,
    }


@app.post("/v1/demo-documents/bien-ban-test-v2")
def seed_bien_ban_test_v2(_: None = Depends(require_service_key)):
    if not (os.environ.get("DOCUMENT_DATABASE_URL") or "").strip():
        raise _database_unavailable()
    try:
        with get_session() as session:
            payload = seed_bien_ban_test_v2_demo(session)
            session.commit()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=error_detail("NOT_FOUND", str(exc)))
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()
    return payload


@app.post("/v1/demo-documents/template/{template_id}")
def seed_demo_by_template(template_id: int, _: None = Depends(require_service_key)):
    if not (os.environ.get("DOCUMENT_DATABASE_URL") or "").strip():
        raise _database_unavailable()
    try:
        with get_session() as session:
            payload = seed_demo_for_template(session, template_id=template_id)
            session.commit()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=error_detail("NOT_FOUND", str(exc)))
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()
    return payload


@app.get("/v1/documents/{document_id}")
def get_document(document_id: int, _: None = Depends(require_service_key)):
    if not (os.environ.get("DOCUMENT_DATABASE_URL") or "").strip():
        raise _database_unavailable()
    try:
        with get_session() as session:
            payload = get_document_payload(session, document_id)
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", "Không tìm thấy chứng từ"),
        )
    return payload


@app.post("/v1/documents/{document_id}/pdf")
async def render_document_pdf(
    document_id: int,
    body: StoredPdfBody = StoredPdfBody(),
    _: None = Depends(require_service_key),
):
    if not (os.environ.get("DOCUMENT_DATABASE_URL") or "").strip():
        raise _database_unavailable()
    try:
        with get_session() as session:
            payload = get_document_payload(session, document_id)
            if payload is None:
                raise HTTPException(
                    status_code=404,
                    detail=error_detail("NOT_FOUND", "Không tìm thấy chứng từ"),
                )
            metadata = load_metadata_from_db(session, payload["template_id"])
    except HTTPException:
        raise
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()

    if metadata is None:
        raise HTTPException(
            status_code=404,
            detail=error_detail("NOT_FOUND", NOT_FOUND_MESSAGE),
        )

    if body.signature_block is not None:
        try:
            metadata.signature_block = parse_signature_block_config(
                body.signature_block.model_dump()
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=error_detail("BAD_REQUEST", str(exc)),
            )

    try:
        content = await run_in_threadpool(
            render_pdf,
            metadata=metadata,
            fields=payload["fields"],
            rows=payload["rows"],
            signatures=body.signatures or payload.get("signatures") or {},
            signature_dates=body.signature_dates or payload.get("signature_dates") or {},
        )
    except PaginationError as exc:
        raise HTTPException(
            status_code=400,
            detail=error_detail("PAGINATION_FAILED", str(exc)),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=error_detail("BAD_REQUEST", str(exc)),
        )

    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": _document_content_disposition(
                metadata.name, metadata.version
            )
        },
    )


@app.post("/v1/parse")
async def parse_upload(
    _: None = Depends(require_service_key),
    file: UploadFile = File(...),
    sheet: Optional[str] = Query(default=None),
):
    filename = (file.filename or "").lower()
    if not filename.endswith(".xlsx"):
        raise HTTPException(
            status_code=400,
            detail=error_detail("INVALID_FORMAT", "Chỉ hỗ trợ file .xlsx"),
        )

    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(
            status_code=400,
            detail=error_detail(
                "FILE_TOO_LARGE", f"File vượt quá {MAX_UPLOAD // (1024 * 1024)} MB"
            ),
        )

    try:
        return await run_in_threadpool(parse_xlsx, data, sheet=sheet)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=value_error_detail(exc))


class ExportBody(BaseModel):
    sheet: str = "Sheet1"
    rows: list[list]


@app.post("/v1/export")
def export(
    body: ExportBody,
    _: None = Depends(require_service_key),
):
    try:
        content = export_xlsx(body.sheet, body.rows)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=value_error_detail(exc))

    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="export.xlsx"'},
    )


class PaginationPlanBody(BaseModel):
    n_rows: int
    page_content_height: float
    continuation_content_height: Optional[float] = None
    header_height: float = 0
    carry_row_height: float = 0
    signature_block_height: float = 0
    row_height_min: float = 18
    row_height_max: float = 28
    min_rows_last_page: int = 2
    stretch_strategy: str = "end_bias"


@app.post("/v1/pagination/plan")
def pagination_plan(
    body: PaginationPlanBody,
    _: None = Depends(require_service_key),
):
    try:
        result = plan_pages(
            n_rows=body.n_rows,
            page_content_height=body.page_content_height,
            continuation_content_height=body.continuation_content_height,
            header_height=body.header_height,
            carry_row_height=body.carry_row_height,
            signature_block_height=body.signature_block_height,
            row_height_min=body.row_height_min,
            row_height_max=body.row_height_max,
            min_rows_last_page=body.min_rows_last_page,
            stretch_strategy=body.stretch_strategy,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=value_error_detail(exc))

    return asdict(result)
