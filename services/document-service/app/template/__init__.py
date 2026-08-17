from app.template.metadata import (
    ColumnMeta,
    FieldMeta,
    PageMeta,
    TableMeta,
    TemplateMetadata,
)


def build_demo_metadata(*args, **kwargs):
    from app.template.demo_metadata import build_demo_metadata as build

    return build(*args, **kwargs)


__all__ = [
    "ColumnMeta",
    "FieldMeta",
    "PageMeta",
    "TableMeta",
    "TemplateMetadata",
    "build_demo_metadata",
]
