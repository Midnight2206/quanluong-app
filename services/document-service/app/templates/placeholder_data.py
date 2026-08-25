from __future__ import annotations

from app.render.signature_block import default_signature_block
from app.template.metadata import TemplateMetadata

PLACEHOLDER_ROW_COUNT = 25
LONG_TEXT = (
    "Hàng mẫu tên rất dài để kiểm tra wrap và shrink trên cột bảng chứng từ "
    "quyết toán - không được tràn ô, không được cắt mất nghĩa khi render PDF."
)


def generate_placeholder_data(
    metadata: TemplateMetadata,
) -> tuple[dict, list[dict], dict[str, str]]:
    fields = {field.field_name: f"{field.field_name} (mẫu)" for field in metadata.fields}
    rows = []
    column_keys = [column.key for column in metadata.table.columns]

    for index in range(PLACEHOLDER_ROW_COUNT):
        row = {}
        for key in column_keys:
            if key in {"stt", "so_tt"}:
                row[key] = str(index + 1)
            elif "ten" in key or key in {"ten_hang", "ten_mat_hang"}:
                row[key] = LONG_TEXT if index == 0 else f"Hàng mẫu {index + 1}"
            elif key in {"so_luong", "sl"}:
                row[key] = str((index + 1) * 1.5)
            else:
                row[key] = f"{key}-{index + 1}"
        rows.append(row)

    signatures = {}
    for slot in (metadata.signature_block or default_signature_block()).slots:
        signatures[slot.key] = (
            slot.static_name if slot.source == "static" and slot.static_name else "(Tên người ký mẫu)"
        )

    return fields, rows, signatures
