from app.render.signature_block import default_signature_block
from app.template.metadata import (
    ColumnMeta,
    FieldMeta,
    PageMeta,
    TableMeta,
    TemplateMetadata,
)
from app.templates.placeholder_data import generate_placeholder_data


def _metadata(signature_block=None):
    return TemplateMetadata(
        name="chung-tu",
        version="1",
        page=PageMeta(),
        fields=[
            FieldMeta("don_vi", "ChungTu", "A1", 10, 100),
            FieldMeta("so_phieu", "ChungTu", "A2", 10, 90),
        ],
        table=TableMeta(
            sheet_name="ChungTu",
            header_row_range="A5:B5",
            data_row_template="A6:B6",
            columns=[
                ColumnMeta("stt", "STT", 36, "center"),
                ColumnMeta("ten_hang", "Tên hàng", 180, "left"),
            ],
            row_style=None,
            header_height_pt=24,
        ),
        signature_block=signature_block or default_signature_block(),
    )


def test_generate_placeholder_data_labels_fields_and_long_row():
    fields, rows, signatures = generate_placeholder_data(_metadata())

    assert fields["don_vi"] == "don_vi (mẫu)"
    assert fields["so_phieu"] == "so_phieu (mẫu)"
    assert len(rows) == 25
    assert rows[0]["stt"] == "1"
    assert any(len(str(row.get("ten_hang", ""))) >= 80 for row in rows)
    assert signatures["nguoi_lap"] == "(Tên người ký mẫu)"
