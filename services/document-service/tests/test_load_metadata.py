import importlib

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Template, TemplateField, TemplateTableConfig
from conftest import make_minimal_template

metadata_store = importlib.import_module("app.import.metadata_store")
template_importer = importlib.import_module("app.import.template_importer")
template_service = importlib.import_module("app.import.template_service")


def test_import_and_load_metadata_round_trip():
    engine = create_engine("sqlite://")
    Template.__table__.create(engine)
    TemplateField.__table__.create(engine)
    TemplateTableConfig.__table__.create(engine)
    xlsx_bytes = make_minimal_template()
    parsed = template_importer.parse_template(
        xlsx_bytes, name="chung-tu", version="1"
    )

    with Session(engine) as session:
        template_id = template_service.import_template(
            session,
            name="chung-tu",
            version="1",
            xlsx_bytes=xlsx_bytes,
        )
        loaded = metadata_store.load_metadata_from_db(session, template_id)

    assert loaded is not None
    assert [field.field_name for field in loaded.fields] == [
        field.field_name for field in parsed.fields
    ]
    assert [column.key for column in loaded.table.columns] == [
        column.key for column in parsed.table.columns
    ]
    assert [column.width_pt for column in loaded.table.columns] == [
        column.width_pt for column in parsed.table.columns
    ]
    assert all(isinstance(column.width_pt, float) for column in loaded.table.columns)
    assert [column.align_h for column in loaded.table.columns] == [
        column.align_h for column in parsed.table.columns
    ]
    assert all(field.label_prefix == "" for field in loaded.fields)


def test_load_metadata_returns_none_for_unknown_template():
    engine = create_engine("sqlite://")
    Template.__table__.create(engine)

    with Session(engine) as session:
        assert metadata_store.load_metadata_from_db(session, 999) is None
