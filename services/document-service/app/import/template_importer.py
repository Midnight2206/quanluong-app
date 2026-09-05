from __future__ import annotations

import re
import unicodedata
from io import BytesIO
from zipfile import BadZipFile

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter, range_boundaries
from openpyxl.utils.cell import column_index_from_string, coordinate_from_string
from openpyxl.utils.exceptions import InvalidFileException

from ..template.metadata import (
    ColumnMeta,
    FieldMeta,
    PageMeta,
    TableMeta,
    TemplateMetadata,
)
from ..template.page_size import page_dimensions
from ..render.font_style import font_dict_from_cell
from .errors import TemplateValidationError
from .excel_coords import (
    DEFAULT_ROW_HEIGHT_PT,
    _column_width_char,
    _row_height_pt,
    cell_top_left_pt,
    col_width_to_pt,
    enclosing_merge_bounds,
    merged_range_height_pt,
    merged_range_width_pt,
    signature_block_height_pt,
)
from .layout_fit import fit_layout_to_page
from .layout_validate import validate_template_layout
from .static_cells import collect_static_cells, static_block_height_pt

_FIELD_NAME_RE = re.compile(r"^[a-z0-9_]+$")


def _find_defined_name(workbook, name: str):
    defined_name = workbook.defined_names.get(name)
    if defined_name is not None:
        return defined_name, None
    matches = [
        (sheet.defined_names[name], sheet)
        for sheet in workbook.worksheets
        if name in sheet.defined_names
    ]
    if len(matches) > 1:
        raise TemplateValidationError(f"Named Range {name} bị trùng giữa nhiều sheet")
    return matches[0] if matches else None


def _normalize_cell_range(cell_range: str) -> str:
    normalized = (cell_range or "").strip()
    if normalized.startswith("="):
        normalized = normalized[1:].strip()
    if "!" in normalized:
        normalized = normalized.rsplit("!", 1)[1].strip()
    if normalized.startswith("$"):
        normalized = normalized.lstrip("$")
    return normalized.replace("$", "")


def _resolve_defined_range(workbook, defined_name, owner_sheet=None):
    name = defined_name.name
    try:
        if owner_sheet is not None and "!" not in defined_name.attr_text:
            destinations = [(owner_sheet.title, defined_name.attr_text)]
        else:
            destinations = list(defined_name.destinations)
    except (AttributeError, TypeError, ValueError) as exc:
        raise TemplateValidationError(
            f"Named Range {name} phải là một vùng hình chữ nhật"
        ) from exc
    if len(destinations) != 1:
        raise TemplateValidationError(
            f"Named Range {name} phải chỉ có một vùng hình chữ nhật"
        )

    sheet_name, cell_range = destinations[0]
    if sheet_name not in workbook.sheetnames:
        raise TemplateValidationError(
            f"Named Range {name} tham chiếu sheet không tồn tại: {sheet_name}"
        )
    try:
        min_col, min_row, max_col, max_row = range_boundaries(
            _normalize_cell_range(cell_range)
        )
    except ValueError as exc:
        raise TemplateValidationError(
            f"Named Range {name} phải là một vùng hình chữ nhật"
        ) from exc
    if None in (min_col, min_row, max_col, max_row):
        raise TemplateValidationError(
            f"Named Range {name} phải tham chiếu vùng ô cụ thể "
            f"(vd. A5:G5), không phải cả dòng/cột"
        )
    normalized = (
        f"{get_column_letter(min_col)}{min_row}:"
        f"{get_column_letter(max_col)}{max_row}"
    )
    return workbook[sheet_name], normalized, (min_col, min_row, max_col, max_row)


def _resolve_range(workbook, name: str):
    found = _find_defined_name(workbook, name)
    if found is None:
        raise TemplateValidationError(f"Thiếu Named Range bắt buộc: {name}")
    return _resolve_defined_range(workbook, *found)


def _all_defined_names(workbook):
    yield from ((defined_name, None) for defined_name in workbook.defined_names.values())
    for sheet in workbook.worksheets:
        yield from (
            (defined_name, sheet) for defined_name in sheet.defined_names.values()
        )


def _assert_merges_within_bounds(
    sheet,
    bounds: tuple[int, int, int, int],
    name: str,
) -> None:
    min_col, min_row, max_col, max_row = bounds
    for cell_range in sheet.merged_cells.ranges:
        intersects = (
            cell_range.min_row <= max_row
            and cell_range.max_row >= min_row
            and cell_range.min_col <= max_col
            and cell_range.max_col >= min_col
        )
        if not intersects:
            continue
        contained = (
            cell_range.min_col >= min_col
            and cell_range.max_col <= max_col
            and cell_range.min_row >= min_row
            and cell_range.max_row <= max_row
        )
        if not contained:
            raise TemplateValidationError(
                f"Ô merge của {name} vượt ngoài biên Named Range"
            )


def _merge_groups(
    sheet,
    bounds: tuple[int, int, int, int],
    name: str,
    *,
    allow_multi_row: bool = False,
):
    min_col, min_row, max_col, max_row = bounds
    if not allow_multi_row and min_row != max_row:
        raise TemplateValidationError(f"Named Range {name} phải nằm trên một dòng")
    if allow_multi_row:
        _assert_merges_within_bounds(sheet, bounds, name)
    scan_row = max_row if allow_multi_row else min_row

    groups = []
    col = min_col
    while col <= max_col:
        merged = next(
            (
                cell_range
                for cell_range in sheet.merged_cells.ranges
                if cell_range.min_row <= scan_row <= cell_range.max_row
                and cell_range.min_col <= col <= cell_range.max_col
            ),
            None,
        )
        if merged is None:
            groups.append((col, col))
            col += 1
            continue
        if merged.min_col < min_col or merged.max_col > max_col:
            raise TemplateValidationError(
                f"Ô merge của {name} vượt ngoài biên Named Range"
            )
        groups.append((merged.min_col, merged.max_col))
        col = merged.max_col + 1
    return groups


def _header_title_source_cell(sheet, row: int, col: int):
    cell = sheet.cell(row, col)
    raw = "" if cell.value is None else str(cell.value).strip()
    if raw:
        return cell
    merge_bounds = enclosing_merge_bounds(sheet, row, col)
    if merge_bounds is None:
        return cell
    return sheet.cell(merge_bounds[1], merge_bounds[0])


def _header_cell_title(sheet, row: int, col: int) -> str:
    cell = _header_title_source_cell(sheet, row, col)
    return "" if cell.value is None else str(cell.value).strip()


def _slug(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.replace("Đ", "D").replace("đ", "d"))
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", ascii_text)).strip("_")


def _style_dict(cell):
    font = font_dict_from_cell(cell)
    align = {
        "h": cell.alignment.horizontal or "left",
        "v": cell.alignment.vertical,
        "wrap_text": bool(cell.alignment.wrap_text),
    }
    border = {
        side: getattr(cell.border, side).style
        for side in ("left", "right", "top", "bottom")
    }
    return font, align, border


# Excel paperSize enum → ReportLab page size name.
# Source: OOXML spec §18.18.5 (ST_PrintLayoutPageSizing).
_PAPER_SIZE_MAP: dict[int, str] = {
    1: "Letter",   # 8.5 × 11 in
    5: "Legal",    # 8.5 × 14 in
    9: "A4",       # 210 × 297 mm  (most common in Vietnam)
    11: "A5",
    13: "B5",
    17: "A3",
}


def _map_paper_size(paper_size_enum) -> str:
    try:
        return _PAPER_SIZE_MAP.get(int(paper_size_enum), "A4")
    except (TypeError, ValueError):
        return "A4"


def _page_meta(sheet) -> PageMeta:
    defaults = PageMeta()
    margins = sheet.page_margins

    def margin(name: str) -> float:
        value = getattr(margins, name, None)
        return getattr(defaults, f"margin_{name}") if value is None else float(value) * 72

    setup = sheet.page_setup
    orientation = setup.orientation or "portrait"
    page_size = _map_paper_size(setup.paperSize)
    return PageMeta(
        page_size=page_size,
        orientation=orientation if orientation in {"portrait", "landscape"} else "portrait",
        margin_top=margin("top"),
        margin_right=margin("right"),
        margin_bottom=margin("bottom"),
        margin_left=margin("left"),
    )


def _page_height(page: PageMeta) -> float:
    return page_dimensions(page)[1]


def _build_fields(workbook, page: PageMeta) -> list[FieldMeta]:
    fields = []
    for defined_name, owner_sheet in _all_defined_names(workbook):
        if not defined_name.name.startswith("FIELD_"):
            continue
        field_name = defined_name.name[len("FIELD_") :]
        if not _FIELD_NAME_RE.fullmatch(field_name):
            raise TemplateValidationError(
                f"Named Range {defined_name.name} có field_name không hợp lệ"
            )
        sheet, _, bounds = _resolve_defined_range(
            workbook, defined_name, owner_sheet
        )
        min_col, min_row, max_col, max_row = bounds
        if (min_col, min_row) != (max_col, max_row):
            raise TemplateValidationError(
                f"Named Range {defined_name.name} phải tham chiếu một ô"
            )
        cell = sheet.cell(min_row, min_col)
        merge_bounds = enclosing_merge_bounds(sheet, min_row, min_col)
        if merge_bounds is not None:
            geom_col, geom_row, geom_max_col, geom_max_row = merge_bounds
            style_cell = sheet.cell(geom_row, geom_col)
        else:
            geom_col, geom_row, geom_max_col, geom_max_row = (
                min_col,
                min_row,
                min_col,
                min_row,
            )
            style_cell = cell
        x, y_top = cell_top_left_pt(
            sheet,
            geom_row,
            geom_col,
            page_height=_page_height(page),
            margin_top=page.margin_top,
            margin_left=page.margin_left,
        )
        if merge_bounds is not None:
            width = merged_range_width_pt(sheet, geom_col, geom_max_col)
            height = merged_range_height_pt(sheet, geom_row, geom_max_row)
        else:
            width = col_width_to_pt(_column_width_char(sheet, min_col))
            height = _row_height_pt(sheet, min_row)
        font, align, border = _style_dict(style_cell)
        fields.append(
            FieldMeta(
                field_name=field_name,
                sheet_name=sheet.title,
                cell_ref=cell.coordinate,
                x=x,
                y=y_top,
                font=font,
                align=align,
                border=border,
                width_pt=width,
                height_pt=height,
            )
        )
    return fields


def _field_skip_coords(workbook, fields: list[FieldMeta]) -> set[tuple[int, int]]:
    coords: set[tuple[int, int]] = set()
    for field in fields:
        sheet = workbook[field.sheet_name]
        column, row = coordinate_from_string(field.cell_ref)
        col = column_index_from_string(column)
        merge_bounds = enclosing_merge_bounds(sheet, row, col)
        if merge_bounds is not None:
            min_col, min_row, max_col, max_row = merge_bounds
            for r in range(min_row, max_row + 1):
                for c in range(min_col, max_col + 1):
                    coords.add((r, c))
        else:
            coords.add((row, col))
    return coords


def _mark_fields_below_table(
    fields: list[FieldMeta],
    *,
    data_row_y: float,
) -> None:
    """FIELD_* có y thấp hơn TABLE_DATA_ROW (gần đáy trang hơn) → below_table."""
    for field in fields:
        field.below_table = field.y < data_row_y


def parse_template(
    xlsx_bytes: bytes, *, name: str, version: str
) -> TemplateMetadata:
    try:
        workbook = load_workbook(BytesIO(xlsx_bytes), data_only=False)
    except (BadZipFile, InvalidFileException, OSError, ValueError, TypeError) as exc:
        raise ValueError("File không phải .xlsx hợp lệ") from exc

    header_sheet, header_ref, header_bounds = _resolve_range(
        workbook, "TABLE_HEADER"
    )
    data_sheet, data_ref, data_bounds = _resolve_range(workbook, "TABLE_DATA_ROW")
    if header_sheet.title != data_sheet.title:
        raise TemplateValidationError(
            "TABLE_HEADER và TABLE_DATA_ROW phải cùng sheet"
        )

    header_groups = _merge_groups(
        header_sheet, header_bounds, "TABLE_HEADER", allow_multi_row=True
    )
    data_groups = _merge_groups(data_sheet, data_bounds, "TABLE_DATA_ROW")
    if len(header_groups) != len(data_groups):
        raise TemplateValidationError(
            "Số cột TABLE_HEADER và TABLE_DATA_ROW không khớp: "
            f"{len(header_groups)} và {len(data_groups)}"
        )
    if header_groups != data_groups:
        raise TemplateValidationError(
            "biên cột TABLE_HEADER và TABLE_DATA_ROW không khớp"
        )

    used_keys: dict[str, int] = {}
    columns = []
    header_top_row = header_bounds[1]
    header_bottom_row = header_bounds[3]
    for min_col, max_col in header_groups:
        cell = _header_title_source_cell(header_sheet, header_bottom_row, min_col)
        title = _header_cell_title(header_sheet, header_bottom_row, min_col)
        base_key = _slug(title)
        if not _FIELD_NAME_RE.fullmatch(base_key):
            raise TemplateValidationError(
                f"Tiêu đề cột không tạo được key hợp lệ: {title!r}"
            )
        used_keys[base_key] = used_keys.get(base_key, 0) + 1
        count = used_keys[base_key]
        key = base_key if count == 1 else f"{base_key}_{count}"
        align_h = cell.alignment.horizontal or "left"
        if align_h not in {"left", "center", "right"}:
            align_h = "left"
        columns.append(
            ColumnMeta(
                key=key,
                title=title,
                width_pt=merged_range_width_pt(header_sheet, min_col, max_col),
                align_h=align_h,
            )
        )

    page = _page_meta(header_sheet)
    page_height = _page_height(page)
    fields = _build_fields(workbook, page)
    data_row_y = cell_top_left_pt(
        data_sheet,
        data_bounds[1],
        data_bounds[0],
        page_height=page_height,
        margin_top=page.margin_top,
        margin_left=page.margin_left,
    )[1]
    _mark_fields_below_table(fields, data_row_y=data_row_y)
    static_cells = collect_static_cells(
        workbook,
        sheet_name=header_sheet.title,
        header_bounds=header_bounds,
        data_bounds=data_bounds,
        page_height=page_height,
        margin_top=page.margin_top,
        margin_left=page.margin_left,
        field_coords=_field_skip_coords(workbook, fields),
    )
    page.static_block_height_pt = static_block_height_pt(header_sheet, header_bounds[1])
    signature_height = 80.0
    if _find_defined_name(workbook, "TABLE_SIGNATURE") is not None:
        signature_sheet, _, signature_bounds = _resolve_range(
            workbook, "TABLE_SIGNATURE"
        )
        if signature_sheet.title != header_sheet.title:
            raise TemplateValidationError(
                "TABLE_SIGNATURE và TABLE_HEADER phải cùng sheet"
            )
        signature_y = cell_top_left_pt(
            signature_sheet,
            signature_bounds[1],
            signature_bounds[0],
            page_height=_page_height(page),
            margin_top=page.margin_top,
            margin_left=page.margin_left,
        )[1]
        computed_signature_height = signature_block_height_pt(
            signature_y, page.margin_bottom
        )
        if computed_signature_height > 0:
            signature_height = computed_signature_height

    header_height = sum(
        float(_row_height_pt(header_sheet, row) or DEFAULT_ROW_HEIGHT_PT)
        for row in range(header_top_row, header_bottom_row + 1)
    )
    data_cell = data_sheet.cell(data_bounds[1], data_bounds[0])
    header_cell = _header_title_source_cell(
        header_sheet, header_bottom_row, header_bounds[0]
    )
    header_font, header_align, header_border = _style_dict(header_cell)
    row_font, row_align, row_border = _style_dict(data_cell)
    data_row_height = float(
        _row_height_pt(data_sheet, data_bounds[1]) or DEFAULT_ROW_HEIGHT_PT
    )
    table_left_x, _ = cell_top_left_pt(
        header_sheet,
        header_top_row,
        header_bounds[0],
        page_height=page_height,
        margin_top=page.margin_top,
        margin_left=page.margin_left,
    )
    table = TableMeta(
        sheet_name=header_sheet.title,
        header_row_range=header_ref,
        data_row_template=data_ref,
        columns=columns,
        row_style={
            "font": row_font,
            "align": row_align,
            "border": row_border,
            "header_font": header_font,
            "header_align": header_align,
            "header_border": header_border,
        },
        header_height_pt=float(header_height or DEFAULT_ROW_HEIGHT_PT),
        signature_block_height_pt=signature_height,
        row_height_min=data_row_height,
        row_height_max=max(28.0, data_row_height),
    )
    metadata = TemplateMetadata(
        name=name,
        version=version,
        page=page,
        fields=fields,
        table=table,
        static_cells=static_cells,
        signature_block=None,  # cấu hình khối ký do app/Node cung cấp lúc render; default khi vẽ
    )
    fit_layout_to_page(metadata, table_left_x=table_left_x)
    validate_template_layout(metadata)
    return metadata


__all__ = ["parse_template"]
