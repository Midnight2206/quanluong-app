import importlib
from dataclasses import replace

import pytest

from app.template.demo_metadata import build_demo_metadata
from app.template.metadata import ColumnMeta, FieldMeta

errors = importlib.import_module("app.import.errors")
layout_validate = importlib.import_module("app.import.layout_validate")


def test_demo_metadata_passes_layout_validate():
    layout_validate.validate_template_layout(build_demo_metadata())


def test_validate_table_fits_page_rejects_wide_columns():
    metadata = build_demo_metadata()
    wide = [replace(column, width_pt=400) for column in metadata.table.columns]
    table = replace(metadata.table, columns=wide)
    with pytest.raises(errors.TemplateValidationError, match="Tổng độ rộng cột"):
        layout_validate.validate_table_fits_page(metadata.page, table)


def test_validate_fields_within_margins_rejects_outside():
    metadata = build_demo_metadata()
    field = FieldMeta(
        field_name="ngoai_le",
        sheet_name="demo",
        cell_ref="Z99",
        x=-10,
        y=10,
    )
    with pytest.raises(errors.TemplateValidationError, match="ngoai_le"):
        layout_validate.validate_fields_within_margins(metadata.page, [field])


def test_validate_signature_fits_page_rejects_too_tall():
    metadata = build_demo_metadata()
    usable = layout_validate.last_page_usable_height(metadata.page, metadata.table)
    table = replace(metadata.table, signature_block_height_pt=usable + 50)
    with pytest.raises(errors.TemplateValidationError, match="Khối chữ ký"):
        layout_validate.validate_signature_fits_page(metadata.page, table)
