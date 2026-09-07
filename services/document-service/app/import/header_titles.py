from __future__ import annotations

import re
import unicodedata

_WEAK_TITLE_RE = re.compile(r"^(?:[A-Za-z]|\d{1,2})$")
_FIELD_NAME_RE = re.compile(r"^[a-z0-9_]+$")


def is_weak_header_title(title: str | None) -> bool:
    text = str(title or "").strip()
    if not text:
        return True
    return bool(_WEAK_TITLE_RE.fullmatch(text))


def slug_header_title(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.replace("Đ", "D").replace("đ", "d"))
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", ascii_text)).strip("_")


def unique_column_key(base_key: str, used_keys: dict[str, int]) -> str:
    key = base_key if _FIELD_NAME_RE.fullmatch(base_key) else "col"
    used_keys[key] = used_keys.get(key, 0) + 1
    count = used_keys[key]
    return key if count == 1 else f"{key}_{count}"


__all__ = [
    "is_weak_header_title",
    "slug_header_title",
    "unique_column_key",
]
