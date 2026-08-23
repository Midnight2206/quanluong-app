from __future__ import annotations

import os
from dataclasses import asdict
from importlib import import_module
from typing import Optional
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool

from app.auth import require_service_key
from app.db import get_session
from app.errors import error_detail, value_error_detail
from app.export import export_xlsx
from app.models import Template
from app.pagination import PaginationError, plan_pages
from app.parse import parse_xlsx
from app.render.pdf_renderer import render_pdf
from app.render.signature_block import default_signature_block, parse_signature_block_config

_template_errors = import_module("app.import.errors")
import_template = import_module("app.import.template_service").import_template
load_metadata_from_db = import_module("app.import.metadata_store").load_metadata_from_db
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
def list_templates(_: None = Depends(require_service_key)):
    if not (os.environ.get("DOCUMENT_DATABASE_URL") or "").strip():
        return []

    try:
        with get_session() as session:
            templates = session.scalars(select(Template).order_by(Template.id)).all()
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


class DocumentBody(BaseModel):
    fields: dict
    rows: list[dict]


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

    try:
        content = await run_in_threadpool(
            render_pdf,
            metadata=metadata,
            fields=body.fields,
            rows=body.rows,
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
