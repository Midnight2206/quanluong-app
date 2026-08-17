from __future__ import annotations

from app.render.demo_template import (
    CARRY_HEIGHT,
    DEMO_COLUMNS,
    DEMO_FIELDS,
    HEADER_HEIGHT,
    MARGIN_BOTTOM,
    MARGIN_LEFT,
    MARGIN_RIGHT,
    MARGIN_TOP,
    MIN_ROWS_LAST_PAGE,
    ROW_HEIGHT_MAX,
    ROW_HEIGHT_MIN,
    SIGNATURE_HEIGHT,
    STATIC_BLOCK_HEIGHT,
)
from app.template.metadata import (
    ColumnMeta,
    FieldMeta,
    PageMeta,
    TableMeta,
    TemplateMetadata,
)

_DEMO_SHEET = "demo"
_DEMO_HEADER_RANGE = "A10:E10"
_DEMO_DATA_ROW = "A11:E11"


def build_demo_metadata(*, name: str = "demo", version: str = "1") -> TemplateMetadata:
    columns = [
        ColumnMeta(key=col.key, title=col.title, width_pt=col.width, align_h=col.align)
        for col in DEMO_COLUMNS
    ]
    fields = [
        FieldMeta(
            field_name=f.field_name,
            sheet_name=_DEMO_SHEET,
            cell_ref=_demo_cell_ref(f.field_name),
            x=f.x,
            y=f.y,
            font={"size": f.font_size, "bold": f.bold},
            align={"h": f.align},
            border=None,
            label_prefix=f.prefix,
        )
        for f in DEMO_FIELDS
    ]
    table = TableMeta(
        sheet_name=_DEMO_SHEET,
        header_row_range=_DEMO_HEADER_RANGE,
        data_row_template=_DEMO_DATA_ROW,
        columns=columns,
        row_style=None,
        header_height_pt=HEADER_HEIGHT,
        carry_height_pt=CARRY_HEIGHT,
        signature_block_height_pt=SIGNATURE_HEIGHT,
        row_height_min=ROW_HEIGHT_MIN,
        row_height_max=ROW_HEIGHT_MAX,
        min_rows_last_page=MIN_ROWS_LAST_PAGE,
    )
    page = PageMeta(
        margin_top=MARGIN_TOP,
        margin_right=MARGIN_RIGHT,
        margin_bottom=MARGIN_BOTTOM,
        margin_left=MARGIN_LEFT,
        static_block_height_pt=STATIC_BLOCK_HEIGHT,
    )
    return TemplateMetadata(name=name, version=version, page=page, fields=fields, table=table)


def _demo_cell_ref(field_name: str) -> str:
    refs = {
        "tieu_de": "A1",
        "don_vi": "A2",
        "ngay_thang": "E2",
        "so_phieu": "A3",
    }
    return refs.get(field_name, "A1")
