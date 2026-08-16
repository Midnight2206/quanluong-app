from __future__ import annotations

import os
from typing import Optional

from fastapi import Header, HTTPException


def require_service_key(
    x_service_key: Optional[str] = Header(default=None, alias="X-Service-Key"),
):
    expected = (os.environ.get("EXCEL_SERVICE_KEY") or "").strip()
    if not expected or x_service_key != expected:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid service key",
                }
            },
        )
