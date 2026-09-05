from __future__ import annotations

FIELD_PREFIX = "FIELD_"
NL_FIELD_PREFIX = "NL_FIELD_"
FIELD_PREFIXES = (FIELD_PREFIX, NL_FIELD_PREFIX)


def split_field_named_range(name: str) -> tuple[str, str] | tuple[None, None]:
    raw_name = str(name or "").strip()
    for prefix in FIELD_PREFIXES:
        if raw_name.startswith(prefix):
            return prefix, raw_name[len(prefix) :]
    return None, None


def is_field_named_range(name: str) -> bool:
    prefix, _ = split_field_named_range(name)
    return prefix is not None


def is_nl_field_named_range(name: str) -> bool:
    prefix, _ = split_field_named_range(name)
    return prefix == NL_FIELD_PREFIX


__all__ = [
    "FIELD_PREFIX",
    "FIELD_PREFIXES",
    "NL_FIELD_PREFIX",
    "is_field_named_range",
    "is_nl_field_named_range",
    "split_field_named_range",
]
