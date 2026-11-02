import os
from pathlib import Path

import pytest

os.environ["DOCUMENT_SERVICE_KEY"] = "test-key"

from fastapi.testclient import TestClient
from pypdf import PdfReader
from io import BytesIO

import app.main as main
from app.render.kitchen_ledger_book import render_kitchen_ledger_book

client = TestClient(main.app)
AUTH = {"X-Service-Key": "test-key"}

MONEY = {
    "openingAmount": "15.702.720",
    "inAmount": "5.623.000",
    "totalInAmount": "21.325.720",
    "mealAmount": "7.075.180",
    "otherAmount": "",
    "totalOutAmount": "7.075.180",
}


def _row():
    return {
        "stt": "1",
        "name": "Gạo tẻ thường",
        "uom": "Kg",
        "price": "16.000",
        "openingQty": "763,12",
        "openingAmount": "12.209.920",
        "inG": "",
        "inH": "",
        "inI": "",
        "inJ": "",
        "inAmount": "",
        "totalInQty": "763,12",
        "totalInAmount": "12.209.920",
        "mealQty": "66,48",
        "mealAmount": "1.063.680",
        "otherQty": "",
        "otherAmount": "",
        "totalOutQty": "66,48",
        "totalOutAmount": "1.063.680",
    }


def _book(tail=None):
    row = _row()
    return {
        "year": 2026,
        "month": 10,
        "cover": {
            "unitName": "Tiểu đoàn",
            "commander": "",
            "keeper": "",
            "dateLine": "Ngày 01 tháng 10 năm 2026",
            "draftDays": ["2026-10-02"],
        },
        "signatures": {"quan_ly": "Người quản lý", "truc_ban": "", "chi_huy": "Người chỉ huy"},
        "days": [
            {
                "date": "2026-10-01",
                "dateLine": "Ngày 01 tháng 10 năm 2026",
                "draft": False,
                "note": "",
                "financeLines": [
                    {"label": "Thu", "value": ""},
                    {"label": "Cộng thu:", "value": "7.302.380"},
                ],
                "sheets": [
                    {
                        "rows": [row],
                        "carryIn": None,
                        "carryOut": MONEY,
                        "showTotal": False,
                        "showSignature": False,
                    },
                    {
                        "rows": [row, row],
                        "carryIn": MONEY,
                        "carryOut": None,
                        "showTotal": True,
                        "showSignature": True,
                        "totals": MONEY,
                    },
                ],
            },
            {
                "date": "2026-10-02",
                "dateLine": "Ngày 02 tháng 10 năm 2026",
                "draft": True,
                "note": "",
                "financeLines": [],
                "sheets": [{
                    "rows": [],
                    "carryIn": None,
                    "carryOut": None,
                    "showTotal": False,
                    "showSignature": True,
                }],
            },
        ],
        "tail": tail,
    }


def _text(pdf: bytes) -> tuple[PdfReader, str]:
    reader = PdfReader(BytesIO(pdf))
    blob = " ".join("\n".join((page.extract_text() or "") for page in reader.pages).split())
    return reader, blob


def test_month_book_pages_cover_carry_watermark_signatures():
    reader, blob = _text(render_kitchen_ledger_book(_book()))
    # Bìa + 2 tờ (trái/phải) của ngày 1 + 1 tờ của ngày nháp. Không trang trắng.
    assert len(reader.pages) == 7
    assert all((page.extract_text() or "").strip() for page in reader.pages)
    assert "Giao sổ này cho đồng chí" in blob
    assert "Ngày 01 tháng 10 năm 2026" in blob
    assert "Chưa chốt, trang các ngày sau in NHÁP: 02/10" in blob
    assert "Cộng sang trang" in blob
    assert "Mang sang" in blob
    assert "15.702.720" in blob
    assert "5.623.000" in blob
    assert "21.325.720" in blob
    assert "7.075.180" in blob
    assert "NHÁP" in blob
    assert "QUẢN LÝ ĐƠN VỊ" in blob
    assert "TRỰC BAN" in blob
    assert "CHỈ HUY ĐƠN VỊ" in blob
    assert "Cộng thu:" in blob
    assert "Đuôi sổ" not in blob


def test_tail_hook_appends_one_page():
    reader, blob = _text(render_kitchen_ledger_book(_book(tail={"title": "Đuôi sổ"})))
    assert len(reader.pages) == 8
    assert "Đuôi sổ" in blob


def test_http_render_requires_key_and_returns_pdf():
    denied = client.post("/v1/render/kitchen-ledger-book", json=_book())
    assert denied.status_code == 401
    ok = client.post("/v1/render/kitchen-ledger-book", headers=AUTH, json=_book())
    assert ok.status_code == 200
    assert ok.headers["content-type"] == "application/pdf"
    reader = PdfReader(BytesIO(ok.content))
    assert len(reader.pages) == 7
    bad = client.post("/v1/render/kitchen-ledger-book", headers=AUTH, json={"year": 2026})
    assert bad.status_code == 400


def test_reference_month_pdf_when_present():
    path = Path("/tmp/quy-tac/Tháng 10-2026/1. Sổ nhập xuất LTTP.pdf")
    if not path.is_file():
        pytest.skip("không có PDF tháng mẫu trên máy này")
    reader = PdfReader(str(path))
    cover = reader.pages[0].extract_text() or ""
    assert "Giao sổ này cho đồng chí" in cover
    assert "CHỈ HUY ĐƠN VỊ" in cover
    blob = "\n".join((page.extract_text() or "") for page in reader.pages[:6])
    assert "Cộng sang trang" in blob
    assert "Mang sang" in blob
    assert "QUẢN LÝ ĐƠN VỊ" in blob
    assert "TRỰC BAN" in blob
