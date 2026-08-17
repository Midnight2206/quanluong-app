import importlib
from io import BytesIO

import pytest
from openpyxl import load_workbook
from openpyxl.workbook.defined_name import DefinedName

from conftest import make_minimal_template, make_mismatched_columns_template


def _parse_template(xlsx_bytes: bytes):
    module = importlib.import_module("app.import.template_importer")
    return module.parse_template(xlsx_bytes, name="chung-tu", version="1")


def _change_name(xlsx_bytes: bytes, name: str, target: str) -> bytes:
    workbook = load_workbook(BytesIO(xlsx_bytes))
    del workbook.defined_names[name]
    workbook.defined_names.add(DefinedName(name, attr_text=target))
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def test_parse_minimal_template():
    metadata = _parse_template(make_minimal_template())

    assert metadata.name == "chung-tu"
    assert metadata.version == "1"
    assert metadata.table.sheet_name == "ChungTu"
    assert metadata.table.header_row_range == "A5:G5"
    assert metadata.table.data_row_template == "A6:G6"
    assert [field.field_name for field in metadata.fields] == [
        "don_vi",
        "ngay_thang",
    ]
    assert [column.key for column in metadata.table.columns] == [
        "stt",
        "ten_hang",
        "dvt",
        "so_luong",
        "ghi_chu",
    ]
    assert [column.width_pt for column in metadata.table.columns] == [
        35,
        119,
        49,
        70,
        84,
    ]
    assert metadata.table.header_height_pt == 24
    assert metadata.table.signature_block_height_pt == 80


def test_rejects_mismatched_column_count():
    errors = importlib.import_module("app.import.errors")

    with pytest.raises(errors.TemplateValidationError, match=r"5.*4"):
        _parse_template(make_mismatched_columns_template())


def test_rejects_missing_required_named_range():
    errors = importlib.import_module("app.import.errors")
    workbook = load_workbook(BytesIO(make_minimal_template()))
    del workbook.defined_names["TABLE_HEADER"]
    output = BytesIO()
    workbook.save(output)

    with pytest.raises(errors.TemplateValidationError, match="TABLE_HEADER"):
        _parse_template(output.getvalue())


def test_rejects_table_ranges_on_different_sheets():
    errors = importlib.import_module("app.import.errors")
    workbook = load_workbook(BytesIO(make_minimal_template()))
    workbook.create_sheet("Other")
    output = BytesIO()
    workbook.save(output)
    changed = _change_name(
        output.getvalue(), "TABLE_DATA_ROW", "'Other'!$A$6:$G$6"
    )

    with pytest.raises(errors.TemplateValidationError, match="cùng sheet"):
        _parse_template(changed)


def test_rejects_misaligned_column_bounds():
    errors = importlib.import_module("app.import.errors")
    workbook = load_workbook(BytesIO(make_minimal_template()))
    sheet = workbook["ChungTu"]
    sheet.unmerge_cells("B6:C6")
    sheet.unmerge_cells("E6:F6")
    sheet.merge_cells("C6:D6")
    sheet.merge_cells("F6:G6")
    del workbook.defined_names["TABLE_DATA_ROW"]
    workbook.defined_names.add(
        DefinedName("TABLE_DATA_ROW", attr_text="'ChungTu'!$B$6:$H$6")
    )
    output = BytesIO()
    workbook.save(output)

    with pytest.raises(errors.TemplateValidationError, match="biên cột"):
        _parse_template(output.getvalue())


def test_rejects_invalid_field_name():
    errors = importlib.import_module("app.import.errors")
    workbook = load_workbook(BytesIO(make_minimal_template()))
    workbook.defined_names.add(
        DefinedName("FIELD_Don-Vi", attr_text="'ChungTu'!$A$2")
    )
    output = BytesIO()
    workbook.save(output)

    with pytest.raises(errors.TemplateValidationError, match="FIELD_Don-Vi"):
        _parse_template(output.getvalue())
