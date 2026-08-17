from __future__ import annotations

import re
import unicodedata
from io import BytesIO
from zipfile import BadZipFile

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter, range_boundaries
from openpyxl.utils.exceptions import InvalidFileException
from reportlab.lib.pagesizes import A4, landscape

from ..template.metadata import (
    ColumnMeta,
    FieldMeta,
    PageMeta,
    TableMeta,
    TemplateMetadata,
)
from .errors import TemplateValidationError
from .excel_coords import (
    DEFAULT_ROW_HEIGHT_PT,
    cell_top_left_pt,
    merged_range_width_pt,
    signature_block_height_pt,
)

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
        min_col, min_row, max_col, max_row = range_boundaries(cell_range)
    except ValueError as exc:
        raise TemplateValidationError(
            f"Named Range {name} phải là một vùng hình chữ nhật"
        ) from exc
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


def _merge_groups(sheet, bounds: tuple[int, int, int, int], name: str):
    min_col, min_row, max_col, max_row = bounds
    if min_row != max_row:
        raise TemplateValidationError(f"Named Range {name} phải nằm trên một dòng")

    groups = []
    col = min_col
    while col <= max_col:
        merged = next(
            (
                cell_range
                for cell_range in sheet.merged_cells.ranges
                if cell_range.min_row <= min_row <= cell_range.max_row
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


def _slug(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.replace("Đ", "D").replace("đ", "d"))
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", ascii_text)).strip("_")


def _style_dict(cell):
    font = {
        "name": cell.font.name,
        "size": cell.font.sz,
        "bold": bool(cell.font.bold),
        "italic": bool(cell.font.italic),
    }
    align = {
        "h": cell.alignment.horizontal or "left",
        "v": cell.alignment.vertical,
        "wrap_text": cell.alignment.wrap_text,
    }
    border = {
        side: getattr(cell.border, side).style
        for side in ("left", "right", "top", "bottom")
    }
    return font, align, border


def _page_meta(sheet) -> PageMeta:
    defaults = PageMeta()
    margins = sheet.page_margins

    def margin(name: str) -> float:
        value = getattr(margins, name, None)
        return getattr(defaults, f"margin_{name}") if value is None else float(value) * 72

    orientation = sheet.page_setup.orientation or "portrait"
    return PageMeta(
        orientation=orientation if orientation in {"portrait", "landscape"} else "portrait",
        margin_top=margin("top"),
        margin_right=margin("right"),
        margin_bottom=margin("bottom"),
        margin_left=margin("left"),
    )


def _page_height(page: PageMeta) -> float:
    return float((landscape(A4) if page.orientation == "landscape" else A4)[1])


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
        x, y = cell_top_left_pt(
            sheet,
            min_row,
            min_col,
            page_height=_page_height(page),
            margin_top=page.margin_top,
            margin_left=page.margin_left,
        )
        font, align, border = _style_dict(cell)
        fields.append(
            FieldMeta(
                field_name=field_name,
                sheet_name=sheet.title,
                cell_ref=cell.coordinate,
                x=x,
                y=y,
                font=font,
                align=align,
                border=border,
            )
        )
    return fields


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

    header_groups = _merge_groups(header_sheet, header_bounds, "TABLE_HEADER")
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
    header_row = header_bounds[1]
    for min_col, max_col in header_groups:
        cell = header_sheet.cell(header_row, min_col)
        title = "" if cell.value is None else str(cell.value).strip()
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

    header_height = header_sheet.row_dimensions[header_row].height
    data_cell = data_sheet.cell(data_bounds[1], data_bounds[0])
    row_font, row_align, row_border = _style_dict(data_cell)
    table = TableMeta(
        sheet_name=header_sheet.title,
        header_row_range=header_ref,
        data_row_template=data_ref,
        columns=columns,
        row_style={
            "font": row_font,
            "align": row_align,
            "border": row_border,
        },
        header_height_pt=float(header_height or DEFAULT_ROW_HEIGHT_PT),
        signature_block_height_pt=signature_height,
    )
    return TemplateMetadata(
        name=name,
        version=version,
        page=page,
        fields=_build_fields(workbook, page),
        table=table,
    )


__all__ = ["parse_template"]
