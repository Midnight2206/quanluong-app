# Task 4 Report — DS guard create-document + folder documents

**Status:** completed

## Delivered

- Added a shared published-template guard in `services/document-service/app/folders/folder_service.py`.
- Enforced `409 TEMPLATE_NOT_PUBLISHED` for:
  - `POST /v1/templates/{id}/documents`
  - `POST /v1/folders/{folder_id}/documents`
- Kept `preview` unguarded as required.
- Updated render-success tests to publish templates first so they reflect the intended contract.

## TDD Notes

- Added failing HTTP test: draft template cannot render via `/v1/templates/{id}/documents`.
- Added failing HTTP test: draft template cannot be added to a folder via `/v1/folders/{folder_id}/documents`.
- Verified both failed before the code change:
  - create-document returned `200` instead of `409`
  - folder add returned `201` instead of `409`
- Implemented the minimal guard, then reran the affected suites to green.

## Verification

- `./.venv/bin/pytest -c services/document-service/pytest.ini services/document-service/tests/test_templates_http.py -k not_published`
- `./.venv/bin/pytest -c services/document-service/pytest.ini services/document-service/tests/test_folder_service.py -k not_published`
- `./.venv/bin/pytest -c services/document-service/pytest.ini services/document-service/tests/test_templates_http.py services/document-service/tests/test_folder_service.py`
- Result: `30 passed`
- IDE lints: none on edited files

## Commit

Planned message: `fix(document): block PDF render unless template published`
