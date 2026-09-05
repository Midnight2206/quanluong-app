from __future__ import annotations

from dataclasses import dataclass


@dataclass
class StaticCellMeta:
    layer: str
    row: int
    x: float
    y: float
    width_pt: float
    height_pt: float
    value: str
    font: dict | None = None
    align: dict | None = None
    border: dict | None = None


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
    below_table: bool = False
    # Kích thước ô Excel — dùng để căn chữ trong box (không stretch full page).
    width_pt: float | None = None
    height_pt: float | None = None
    named_range: str = ""


@dataclass
class ColumnMeta:
    key: str
    title: str
    width_pt: float
    align_h: str


@dataclass
class SignatureSlot:
    key: str
    label: str
    col: int
    col_span: int = 1
    source: str = "dynamic"  # "static" | "dynamic"
    static_name: str | None = None
    show_date_line: bool = False


@dataclass
class SignatureBlockConfig:
    slots: list[SignatureSlot]
    columns: int
    gap_pt: float = 40
    date_line_gap_pt: float = 14

    def __post_init__(self) -> None:
        for slot in self.slots:
            if slot.source == "static" and not (slot.static_name or "").strip():
                raise ValueError(
                    f"SignatureSlot '{slot.key}' source=static nhưng thiếu static_name"
                )
            if slot.source not in {"static", "dynamic"}:
                raise ValueError(
                    f"SignatureSlot '{slot.key}' source không hợp lệ: {slot.source!r}"
                )
            if slot.col < 0 or slot.col_span < 1 or slot.col + slot.col_span > self.columns:
                raise ValueError(
                    f"SignatureSlot '{slot.key}' col/col_span vượt ngoài columns={self.columns}"
                )


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
    static_cells: list[StaticCellMeta] | None = None
    signature_block: SignatureBlockConfig | None = None
