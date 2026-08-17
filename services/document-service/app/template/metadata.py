from __future__ import annotations

from dataclasses import dataclass


@dataclass
class FieldMeta:
    field_name: str
    sheet_name: str
    cell_ref: str
    x: float
    y: float
    font: dict | None = None
    align: dict | None = None
    border: dict | None = None
    label_prefix: str = ""


@dataclass
class ColumnMeta:
    key: str
    title: str
    width_pt: float
    align_h: str


@dataclass
class TableMeta:
    sheet_name: str
    header_row_range: str
    data_row_template: str
    columns: list[ColumnMeta]
    row_style: dict | None
    header_height_pt: float
    carry_height_pt: float = 18
    signature_block_height_pt: float = 80
    row_height_min: float = 18
    row_height_max: float = 28
    min_rows_last_page: int = 2
    stretch_strategy: str = "end_bias"


@dataclass
class PageMeta:
    page_size: str = "A4"
    orientation: str = "portrait"
    margin_top: float = 40
    margin_right: float = 36
    margin_bottom: float = 40
    margin_left: float = 36
    static_block_height_pt: float = 80


@dataclass
class TemplateMetadata:
    name: str
    version: str
    page: PageMeta
    fields: list[FieldMeta]
    table: TableMeta
