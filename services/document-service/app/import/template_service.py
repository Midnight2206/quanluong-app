from __future__ import annotations

from dataclasses import asdict

from sqlalchemy.orm import Session

from app.models import Template, TemplateField, TemplateTableConfig
from app.template.metadata import ColumnMeta, TemplateMetadata

from .blob import BlobStore, NullBlobStore
from .errors import TemplateValidationError
from .template_importer import parse_template


def _validate_required_fields(
    metadata: TemplateMetadata, required_fields: list[str]
) -> None:
    present = {field.field_name for field in metadata.fields}
    missing = [name for name in required_fields if name not in present]
    if missing:
        raise TemplateValidationError(
            f"Thiếu field bắt buộc: {', '.join(missing)}"
        )


def import_template(
    session: Session,
    *,
    name: str,
    version: str,
    xlsx_bytes: bytes,
    blob_store: BlobStore | None = None,
    required_fields: list[str] | None = None,
) -> int:
    blob_store = blob_store or NullBlobStore()
    file_path = blob_store.save(f"templates/{name}/{version}.xlsx", xlsx_bytes)
    metadata = parse_template(xlsx_bytes, name=name, version=version)
    if required_fields is not None:
        _validate_required_fields(metadata, required_fields)

    page = metadata.page
    template = Template(
        name=metadata.name,
        version=metadata.version,
        file_path=file_path,
        page_size=page.page_size,
        orientation=page.orientation,
        margin_top=page.margin_top,
        margin_right=page.margin_right,
        margin_bottom=page.margin_bottom,
        margin_left=page.margin_left,
    )
    session.add(template)
    session.flush()

    for field in metadata.fields:
        session.add(
            TemplateField(
                template_id=template.id,
                field_name=field.field_name,
                sheet_name=field.sheet_name,
                cell_ref=field.cell_ref,
                x=field.x,
                y=field.y,
                font=field.font,
                align=field.align,
                border=field.border,
            )
        )

    table = metadata.table
    session.add(
        TemplateTableConfig(
            template_id=template.id,
            header_row_range=table.header_row_range,
            data_row_template=table.data_row_template,
            column_defs=[asdict(column) for column in table.columns],
            data_row_style=table.row_style,
            header_height_pt=table.header_height_pt,
            carry_height_pt=table.carry_height_pt,
            signature_block_height=table.signature_block_height_pt,
            row_height_min=table.row_height_min,
            row_height_max=table.row_height_max,
            min_rows_last_page=table.min_rows_last_page,
            stretch_strategy=table.stretch_strategy,
        )
    )
    session.commit()
    return template.id


__all__ = ["import_template"]
