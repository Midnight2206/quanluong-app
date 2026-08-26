import importlib

from openpyxl import Workbook

excel_coords = importlib.import_module("app.import.excel_coords")
cell_top_left_pt = excel_coords.cell_top_left_pt
col_width_to_pt = excel_coords.col_width_to_pt
merged_range_width_pt = excel_coords.merged_range_width_pt
merged_range_height_pt = excel_coords.merged_range_height_pt
enclosing_merge_bounds = excel_coords.enclosing_merge_bounds
signature_block_height_pt = excel_coords.signature_block_height_pt
MDW_DEFAULT = excel_coords.MDW_DEFAULT

PAGE_HEIGHT = 842.0
MARGIN_TOP = 40.0
MARGIN_BOTTOM = 40.0
MARGIN_LEFT = 36.0


# --- col_width_to_pt ---

def test_col_width_to_pt_formula():
    # Kiểm tra công thức chính thức Excel với MDW=6 (Tinos/Times NR 11pt):
    # width_px = int(((256*8.43 + int(128/6)) / 256) * 6)
    #           = int(((2158.08 + 21) / 256) * 6)
    #           = int((2179.08 / 256) * 6)
    #           = int(8.51... * 6) = int(51.09...) = 51 px
    # width_pt = 51 * 0.75 = 38.25
    mdw = 6
    w = 8.43
    expected_px = int(((256 * w + int(128 / mdw)) / 256) * mdw)
    expected_pt = max(10.0, expected_px * 0.75)
    assert col_width_to_pt(w) == expected_pt


def test_col_width_to_pt_small_falls_back_to_minimum():
    # col_width ~0 → pixel rất nhỏ → minimum 10pt
    assert col_width_to_pt(0.0) == 10.0
    assert col_width_to_pt(None) == 10.0


def test_col_width_to_pt_known_value():
    # col_width=10, MDW=6:
    # px = int(((256*10 + 21) / 256) * 6) = int((2581/256)*6) = int(10.07*6) = int(60.47) = 60
    # pt = 60 * 0.75 = 45.0
    assert col_width_to_pt(10.0) == 45.0


def test_col_width_to_pt_legacy_not_7x():
    # Công thức cũ * 7 sẽ cho 70.0; công thức mới phải khác
    assert col_width_to_pt(10.0) != 70.0


def test_merged_range_width_pt_three_columns():
    wb = Workbook()
    ws = wb.active
    ws.column_dimensions["A"].width = 10.0
    ws.column_dimensions["B"].width = 12.0
    ws.column_dimensions["C"].width = 8.0

    expected = col_width_to_pt(10.0) + col_width_to_pt(12.0) + col_width_to_pt(8.0)
    assert merged_range_width_pt(ws, 1, 3) == expected


def test_enclosing_merge_bounds():
    wb = Workbook()
    ws = wb.active
    ws.merge_cells("B2:D2")

    assert enclosing_merge_bounds(ws, 2, 2) == (2, 2, 4, 2)
    assert enclosing_merge_bounds(ws, 2, 3) == (2, 2, 4, 2)
    assert enclosing_merge_bounds(ws, 2, 4) == (2, 2, 4, 2)
    assert enclosing_merge_bounds(ws, 1, 1) is None


def test_merged_range_height_pt():
    wb = Workbook()
    ws = wb.active
    ws.row_dimensions[1].height = 20.0
    ws.row_dimensions[2].height = 15.0

    assert merged_range_height_pt(ws, 1, 2) == 35.0


def test_signature_block_height_pt():
    assert signature_block_height_pt(200.0, MARGIN_BOTTOM) == 160.0


def test_cell_top_left_pt():
    wb = Workbook()
    ws = wb.active
    ws.column_dimensions["A"].width = 10.0
    ws.column_dimensions["B"].width = 12.0
    ws.row_dimensions[1].height = 20.0
    ws.row_dimensions[2].height = 15.0

    x, y = cell_top_left_pt(
        ws, 2, 2,
        page_height=PAGE_HEIGHT,
        margin_top=MARGIN_TOP,
        margin_left=MARGIN_LEFT,
    )
    assert x == MARGIN_LEFT + col_width_to_pt(10.0)
    assert y == PAGE_HEIGHT - MARGIN_TOP - 20.0
