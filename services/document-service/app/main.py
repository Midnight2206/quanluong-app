from __future__ import annotations

from dataclasses import asdict
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.auth import require_service_key
from app.errors import error_detail, value_error_detail
from app.export import export_xlsx
from app.pagination import plan_pages
from app.parse import parse_xlsx

MAX_UPLOAD = 5 * 1024 * 1024

app = FastAPI()


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
