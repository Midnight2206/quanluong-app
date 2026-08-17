from app.render.demo_template import CONTENT_WIDTH, DEMO_COLUMNS, DEMO_FIELDS
from app.template.demo_metadata import build_demo_metadata


def test_build_demo_metadata_columns():
    m = build_demo_metadata()
    assert len(m.table.columns) == 5
    assert m.table.columns[0].key == "stt"
    assert sum(c.width_pt for c in m.table.columns) <= CONTENT_WIDTH


def test_build_demo_metadata_fields():
    m = build_demo_metadata()
    assert len(m.fields) == len(DEMO_FIELDS)
    by_name = {f.field_name: f for f in m.fields}
    assert by_name["don_vi"].label_prefix == "Đơn vị: "
    assert by_name["tieu_de"].font == {"size": 14, "bold": True}
    assert by_name["ngay_thang"].align == {"h": "left"}


def test_build_demo_metadata_table_and_page():
    m = build_demo_metadata()
    assert m.name == "demo"
    assert m.version == "1"
    assert m.table.sheet_name == "demo"
    assert m.table.header_height_pt == 22
    assert m.table.carry_height_pt == 18
    assert m.table.signature_block_height_pt == 80
    assert m.page.page_size == "A4"
    assert m.page.margin_top == 40
    assert m.page.static_block_height_pt == 80


def test_build_demo_metadata_column_widths_match_demo_constants():
    m = build_demo_metadata()
    for col_meta, col_def in zip(m.table.columns, DEMO_COLUMNS):
        assert col_meta.key == col_def.key
        assert col_meta.title == col_def.title
        assert col_meta.width_pt == col_def.width
        assert col_meta.align_h == col_def.align
