# Task 4 Report — DS guard create-document + folder documents

**Status:** completed

## Delivered

- Added a shared published-template guard in `services/document-service/app/folders/folder_service.py`.
- Enforced `409 TEMPLATE_NOT_PUBLISHED` for:
  - `POST /v1/templates/{id}/documents`
  - `POST /v1/folders/{folder_id}/documents`
- Kept `preview` unguarded as required.
- Updated render-success tests to publish templates first so they reflect the intended contract.
- **Important finding fix:** In `add_folder_document`, `require_published_template` now runs before the duplicate-filename check so draft templates always return `409 TEMPLATE_NOT_PUBLISHED` even when the filename already exists in the folder.

## TDD Notes

- Added failing HTTP test: draft template cannot render via `/v1/templates/{id}/documents`.
- Added failing HTTP test: draft template cannot be added to a folder via `/v1/folders/{folder_id}/documents`.
- Verified both failed before the code change:
  - create-document returned `200` instead of `409`
  - folder add returned `201` instead of `409`
- Implemented the minimal guard, then reran the affected suites to green.
- Added regression test: folder with existing file + draft template + duplicate filename → `409` (not `400` duplicate-name).

## Verification

- `./.venv/bin/pytest -c services/document-service/pytest.ini services/document-service/tests/test_templates_http.py -k not_published`
- `./.venv/bin/pytest -c services/document-service/pytest.ini services/document-service/tests/test_folder_service.py -k not_published`
- `./.venv/bin/pytest -c services/document-service/pytest.ini services/document-service/tests/test_templates_http.py services/document-service/tests/test_folder_service.py`
- Result: `30 passed`
- IDE lints: none on edited files
- **Follow-up:** `./.venv/bin/pytest tests/test_folder_service.py tests/test_templates_http.py -q` → `31 passed`

## Commits

- `592907d` — `fix(document): block PDF render unless template published`
- Planned message: `fix(document): check published before folder filename conflict`
