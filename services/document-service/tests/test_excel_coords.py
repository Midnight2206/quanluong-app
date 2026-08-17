import importlib

from openpyxl import Workbook

excel_coords = importlib.import_module("app.import.excel_coords")
cell_top_left_pt = excel_coords.cell_top_left_pt
col_width_to_pt = excel_coords.col_width_to_pt
merged_range_width_pt = excel_coords.merged_range_width_pt
signature_block_height_pt = excel_coords.signature_block_height_pt

PAGE_HEIGHT = 842.0
MARGIN_TOP = 40.0
MARGIN_BOTTOM = 40.0


def test_col_width_to_pt():
    assert col_width_to_pt(10.0) == 70.0
    assert col_width_to_pt(1.0) == 10.0
    assert col_width_to_pt(0.0) == 10.0
    assert col_width_to_pt(None) == 10.0


def test_merged_range_width_pt_three_columns():
    wb = Workbook()
    ws = wb.active
    ws.column_dimensions["A"].width = 10.0
    ws.column_dimensions["B"].width = 12.0
    ws.column_dimensions["C"].width = 8.0

    expected = col_width_to_pt(10.0) + col_width_to_pt(12.0) + col_width_to_pt(8.0)
    assert merged_range_width_pt(ws, 1, 3) == expected
    assert merged_range_width_pt(ws, 1, 3) == 210.0


def test_signature_block_height_pt():
    signature_y = 200.0
    assert signature_block_height_pt(signature_y, MARGIN_BOTTOM) == 160.0


def test_cell_top_left_pt():
    wb = Workbook()
    ws = wb.active
    ws.column_dimensions["A"].width = 10.0
    ws.column_dimensions["B"].width = 12.0
    ws.row_dimensions[1].height = 20.0
    ws.row_dimensions[2].height = 15.0

    x, y = cell_top_left_pt(ws, 2, 2, page_height=PAGE_HEIGHT, margin_top=MARGIN_TOP)
    assert x == col_width_to_pt(10.0)
    assert y == PAGE_HEIGHT - MARGIN_TOP - 20.0
