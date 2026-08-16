from __future__ import annotations

from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.auth import require_service_key
from app.errors import error_detail, value_error_detail
from app.export import export_xlsx
from app.parse import parse_xlsx

MAX_UPLOAD = 5 * 1024 * 1024

app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True, "service": "excel"}


@app.post("/v1/parse")
async def parse_upload(
    _: None = Depends(require_service_key),
    file: UploadFile = File(...),
    sheet: Optional[str] = Query(default=None),
):
    filename = (file.filename or "").lower()
    if filename.endswith(".xls") and not filename.endswith(".xlsx"):
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
        return parse_xlsx(data, sheet=sheet)
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
