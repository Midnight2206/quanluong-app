import importlib

import pytest

blob = importlib.import_module("app.import.blob")
errors = importlib.import_module("app.import.errors")


def test_null_blob_store_save_returns_none():
    store = blob.NullBlobStore()
    assert store.save("templates/demo/v1.xlsx", b"data") is None


def test_null_blob_store_load_raises():
    store = blob.NullBlobStore()
    with pytest.raises(NotImplementedError):
        store.load("templates/demo/v1.xlsx")


def test_template_validation_error_is_exception():
    err = errors.TemplateValidationError("Thiếu TABLE_HEADER")
    assert str(err) == "Thiếu TABLE_HEADER"
    assert isinstance(err, Exception)
