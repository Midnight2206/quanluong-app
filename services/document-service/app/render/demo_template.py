from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Align = Literal["left", "center", "right"]

PAGE_WIDTH = 595
PAGE_HEIGHT = 842

MARGIN_TOP = 40
MARGIN_RIGHT = 36
MARGIN_BOTTOM = 40
MARGIN_LEFT = 36

STATIC_BLOCK_HEIGHT = 80

TABLE_LEFT = 36

HEADER_HEIGHT = 22
CARRY_HEIGHT = 18
SIGNATURE_HEIGHT = 80

ROW_HEIGHT_MIN = 18
ROW_HEIGHT_MAX = 28
MIN_ROWS_LAST_PAGE = 2

CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT


@dataclass(frozen=True)
class ColumnDef:
    key: str
    title: str
    width: float
    align: Align


@dataclass(frozen=True)
class FieldDef:
    field_name: str
    x: float
    y: float
    font_size: float
    bold: bool
    prefix: str = ""
    align: Align = "left"


DEMO_COLUMNS: tuple[ColumnDef, ...] = (
    ColumnDef("stt", "STT", 36, "center"),
    ColumnDef("ten_hang", "Tên hàng", 200, "left"),
    ColumnDef("don_vi_tinh", "ĐVT", 50, "center"),
    ColumnDef("so_luong", "SL", 60, "right"),
    ColumnDef("thanh_tien", "Thành tiền", 90, "right"),
)

DEMO_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("tieu_de", 36, 802, 14, True, align="center"),
    FieldDef("don_vi", 36, 778, 10, False, prefix="Đơn vị: "),
    FieldDef("ngay_thang", 400, 778, 10, False, prefix="Ngày: "),
    FieldDef("so_phieu", 36, 762, 10, False, prefix="Số phiếu: "),
)


def content_height_page1() -> float:
    return PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM - STATIC_BLOCK_HEIGHT


def content_height_continuation() -> float:
    return PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM


def table_top_y_page1() -> float:
    return PAGE_HEIGHT - MARGIN_TOP - STATIC_BLOCK_HEIGHT
