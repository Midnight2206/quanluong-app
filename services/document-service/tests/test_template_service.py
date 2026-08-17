import importlib
from unittest.mock import MagicMock

from app.models import Template, TemplateField, TemplateTableConfig
from conftest import make_minimal_template

template_service = importlib.import_module("app.import.template_service")
blob = importlib.import_module("app.import.blob")


def test_import_template_persists_template_fields_and_table_config():
    session = MagicMock()
    added: list[object] = []

    def capture_add(obj: object) -> None:
        added.append(obj)

    def assign_template_id() -> None:
        for obj in added:
            if isinstance(obj, Template) and obj.id is None:
                obj.id = 42

    session.add.side_effect = capture_add
    session.flush.side_effect = assign_template_id

    template_id = template_service.import_template(
        session,
        name="chung-tu",
        version="1",
        xlsx_bytes=make_minimal_template(),
    )

    assert template_id == 42
    session.flush.assert_called_once()
    session.commit.assert_called_once()

    templates = [obj for obj in added if isinstance(obj, Template)]
    fields = [obj for obj in added if isinstance(obj, TemplateField)]
    table_configs = [obj for obj in added if isinstance(obj, TemplateTableConfig)]

    assert len(templates) == 1
    assert len(fields) == 2
    assert len(table_configs) == 1

    template = templates[0]
    assert template.name == "chung-tu"
    assert template.version == "1"
    assert template.file_path is None
    assert template.page_size == "A4"
    assert template.orientation == "portrait"

    assert {field.field_name for field in fields} == {"don_vi", "ngay_thang"}
    assert all(field.template_id == 42 for field in fields)

    table_config = table_configs[0]
    assert table_config.template_id == 42
    assert table_config.header_row_range == "A5:G5"
    assert table_config.data_row_template == "A6:G6"
    assert len(table_config.column_defs) == 5
    assert table_config.signature_block_height == 80


def test_import_template_uses_blob_store_save_result():
    session = MagicMock()
    added: list[object] = []

    class StubBlobStore(blob.BlobStore):
        def save(self, key, content):
            assert key == "demo/v2.xlsx"
            assert content
            return "s3://bucket/demo/v2.xlsx"

        def load(self, key: str) -> bytes:
            raise NotImplementedError

    session.add.side_effect = added.append
    session.flush.side_effect = lambda: setattr(
        next(obj for obj in added if isinstance(obj, Template)), "id", 7
    )

    template_id = template_service.import_template(
        session,
        name="demo",
        version="v2",
        xlsx_bytes=make_minimal_template(),
        blob_store=StubBlobStore(),
    )

    assert template_id == 7
    template = next(obj for obj in added if isinstance(obj, Template))
    assert template.file_path == "s3://bucket/demo/v2.xlsx"
