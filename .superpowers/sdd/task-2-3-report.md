# Task 2-3 Report — document-service folders
Status: completed.

Delivered:
- Added `Folder` / `FolderFile` SQLAlchemy models plus Alembic revision `20260823_0005_folders.py`.
- Added folder storage helpers in `services/document-service/app/folders/local_storage.py` and service logic in `services/document-service/app/folders/folder_service.py` for create/get/add-file/delete/zip/merged-PDF flows.
- Added `/v1/folders` HTTP routes in `services/document-service/app/main.py` with `require_service_key`, error envelopes, file streaming, zip download, and merged PDF download.
- Added `services/document-service/tests/test_folder_service.py` covering create folder, add document, list files, zip/merged downloads, and delete cleanup.

Verification:
- `cd "/Users/midnight/quanluong-app/services/document-service" && .venv/bin/python -m pytest tests/test_folder_service.py -v`
- `ReadLints` on edited document-service files: clean.

Concern:
- `zip` and `merged.pdf` are generated in memory, which is fine for the MVP batch sizes in the spec but may need streaming if folders become very large.
