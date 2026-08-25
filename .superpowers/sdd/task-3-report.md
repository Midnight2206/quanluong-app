# Task 3 Report

Status: completed
Commits: feat(document): publish and retire template status transitions
Tests: `services/document-service/.venv/bin/pytest services/document-service/tests/test_template_publish_http.py`; `services/document-service/.venv/bin/pytest services/document-service/tests/test_templates.py services/document-service/tests/test_template_publish_http.py`
Concerns: broader suite has an unrelated existing failure in `services/document-service/tests/test_templates_http.py::test_create_document_runs_render_in_threadpool`
Report path: `.superpowers/sdd/task-3-report.md`
# Task 3 Report: PDF storage helper

**Status:** Done  
**Branch:** `feat/document-service-p4`  
**Commit:** `feat(chung-tu): store PDF exports under MEDIA_ROOT`

## Deliverables

| File | Purpose |
|------|---------|
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-storage.util.js` | Pure fs helper: build relative path, write/read/delete PDF under `MEDIA_ROOT` |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-storage.util.test.js` | Round-trip test with `os.tmpdir()` via injected `rootDir` |

## API

- `buildChungTuPdfRelativePath({ categoryKey, exportKey, year })` → `chung-tu-pdf/{categoryKey}/{year}/{exportKey}.pdf`
- `writeChungTuPdfFile(relativePath, buffer, rootDir?)` → absolute path; creates parent dirs
- `readChungTuPdfFile(relativePath, rootDir?)` → `Buffer`
- `deleteChungTuPdfFile(relativePath, rootDir?)` → no-op on missing file (`ENOENT`)

Default `rootDir` is `env.mediaRoot` from `../../config/env.js`.

## Test summary

```
node --test quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-storage.util.test.js
✔ chung-tu PDF storage write/read/delete under injected rootDir
ℹ pass 1 / fail 0
```

Test stubs `DATABASE_URL`, `JWT_ACCESS_SECRET`, `SESSION_SECRET` before dynamic import (same pattern as `document-service.client.test.js`) because `env.js` validates required vars at load time.

## Concerns / follow-ups

- No path traversal guard on `relativePath`; callers must pass paths from `buildChungTuPdfRelativePath` only.
- `exportKey` is not sanitized in the builder; upstream should restrict to safe filename characters.
- No integration with Prisma export records yet (Task 4+).
