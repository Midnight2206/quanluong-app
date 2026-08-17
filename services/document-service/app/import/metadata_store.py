from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Template, TemplateField, TemplateTableConfig
from app.template.metadata import (
    ColumnMeta,
    FieldMeta,
    PageMeta,
    TableMeta,
    TemplateMetadata,
)


def _sheet_name(fields: list[TemplateField], header_row_range: str) -> str:
    if fields:
        return fields[0].sheet_name
    if "!" in header_row_range:
        return header_row_range.split("!", 1)[0].strip("'").replace("''", "'")
    return ""


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
        raise ValueError(f"Template {template_id} has no table configuration")

    columns = [
        ColumnMeta(
            key=column["key"],
            title=column["title"],
            width_pt=float(column["width_pt"]),
            align_h=column["align_h"],
        )
        for column in (table_config.column_defs or [])
    ]
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
        ),
        fields=[
            FieldMeta(
                field_name=field.field_name,
                sheet_name=field.sheet_name,
                cell_ref=field.cell_ref,
                x=field.x,
                y=field.y,
                font=field.font,
                align=field.align,
                border=field.border,
                label_prefix="",
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
    )


__all__ = ["load_metadata_from_db"]
