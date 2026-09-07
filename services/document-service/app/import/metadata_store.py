from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Template, TemplateField, TemplateTableConfig
from app.template.metadata import (
    ColumnMeta,
    FieldMeta,
    PageMeta,
    StaticCellMeta,
    TableMeta,
    TemplateMetadata,
)
from .column_key_repair import repair_weak_columns_from_static_headers


def _sheet_name(fields: list[TemplateField], header_row_range: str) -> str:
    if fields:
        return fields[0].sheet_name
    if "!" in header_row_range:
        return header_row_range.split("!", 1)[0].strip("'").replace("''", "'")
    return ""


_ALIGN_META_KEYS = frozenset(
    {"below_table", "cell_width_pt", "cell_height_pt", "named_range"}
)


def _align_without_meta(align: dict | None) -> dict | None:
    if not align:
        return align
    cleaned = {key: value for key, value in align.items() if key not in _ALIGN_META_KEYS}
    return cleaned or None


def load_metadata_from_db(
    session: Session, template_id: int
) -> TemplateMetadata | None:
    template = session.get(Template, template_id)
    if template is None:
        return None

    fields = list(
        session.scalars(
            select(TemplateField)
            .where(TemplateField.template_id == template_id)
            .order_by(TemplateField.id)
        )
    )
    table_config = session.scalar(
        select(TemplateTableConfig).where(
            TemplateTableConfig.template_id == template_id
        )
    )
    if table_config is None:
        return None

    columns = [
        ColumnMeta(
            key=column["key"],
            title=column["title"],
            width_pt=float(column["width_pt"]),
            align_h=column["align_h"],
        )
        for column in (table_config.column_defs or [])
    ]
    static_cells = [
        StaticCellMeta(
            layer=cell["layer"],
            row=int(cell["row"]),
            x=float(cell["x"]),
            y=float(cell["y"]),
            width_pt=float(cell["width_pt"]),
            height_pt=float(cell["height_pt"]),
            value=str(cell.get("value") or ""),
            font=cell.get("font"),
            align=cell.get("align"),
            border=cell.get("border"),
        )
        for cell in (table_config.static_cells or [])
    ]
    columns = repair_weak_columns_from_static_headers(columns, static_cells)
    return TemplateMetadata(
        name=template.name,
        version=template.version,
        page=PageMeta(
            page_size=template.page_size,
            orientation=template.orientation,
            margin_top=float(template.margin_top),
            margin_right=float(template.margin_right),
            margin_bottom=float(template.margin_bottom),
            margin_left=float(template.margin_left),
            static_block_height_pt=float(
                table_config.static_block_height_pt or PageMeta().static_block_height_pt
            ),
        ),
        fields=[
            FieldMeta(
                field_name=field.field_name,
                sheet_name=field.sheet_name,
                cell_ref=field.cell_ref,
                x=field.x,
                y=field.y,
                font=field.font,
                align=_align_without_meta(field.align),
                border=field.border,
                label_prefix="",
                below_table=bool((field.align or {}).get("below_table")),
                width_pt=(
                    float(field.align["cell_width_pt"])
                    if isinstance(field.align, dict) and field.align.get("cell_width_pt") is not None
                    else None
                ),
                height_pt=(
                    float(field.align["cell_height_pt"])
                    if isinstance(field.align, dict) and field.align.get("cell_height_pt") is not None
                    else None
                ),
                named_range=(
                    str(field.align.get("named_range") or "")
                    if isinstance(field.align, dict)
                    else ""
                ),
            )
            for field in fields
        ],
        table=TableMeta(
            sheet_name=_sheet_name(fields, table_config.header_row_range),
            header_row_range=table_config.header_row_range,
            data_row_template=table_config.data_row_template,
            columns=columns,
            row_style=table_config.data_row_style,
            header_height_pt=float(table_config.header_height_pt),
            carry_height_pt=float(table_config.carry_height_pt),
            signature_block_height_pt=float(table_config.signature_block_height),
            row_height_min=float(table_config.row_height_min),
            row_height_max=float(table_config.row_height_max),
            min_rows_last_page=table_config.min_rows_last_page,
            stretch_strategy=table_config.stretch_strategy,
        ),
        static_cells=static_cells or None,
    )


__all__ = ["load_metadata_from_db"]
