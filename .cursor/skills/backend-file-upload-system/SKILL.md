---
name: backend-file-upload-system
description: Guides building or refactoring file upload handling in a Node.js Express JavaScript backend with controlled upload boundaries, file validation, safe storage decisions, and queue-friendly post-upload processing.
---

# Purpose

Dung skill nay khi task lien quan den upload file, xu ly file, hoac luu tru file o backend.
Use this skill when the task involves:

- file upload endpoints
- multipart handling
- file validation
- local or external storage decisions
- post-upload processing
- upload security and limits

# Rules

Skill nay chuan hoa boundary upload file cho backend.
- Handle file uploads at the request boundary through dedicated middleware or upload helpers.
- Validate file size, mime type, and allowed extensions explicitly.
- Keep storage decisions explicit and environment-aware.
- Do not trust client-provided filenames or mime types blindly.
- Keep uploaded file metadata separate from business logic where possible.
- For heavy file processing, hand work off to queue or background jobs.

# Workflow

Doc reference theo dung bai toan upload.
1. Read [references/upload-boundary.md](references/upload-boundary.md) when deciding where file handling belongs.
2. Read [references/file-validation.md](references/file-validation.md) when checking size, type, and allowed files.
3. Read [references/storage-strategy.md](references/storage-strategy.md) when choosing local disk, object storage, or another destination.
4. Read [references/upload-security.md](references/upload-security.md) when handling untrusted user files safely.
5. Read [references/post-upload-flow.md](references/post-upload-flow.md) when the upload should trigger later processing.
6. Reuse [templates/upload-middleware.js](templates/upload-middleware.js), [templates/file-validator.js](templates/file-validator.js), and [templates/storage-service.js](templates/storage-service.js) as the baseline.
7. Use [examples/avatar-upload.js](examples/avatar-upload.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-security-system` for request-boundary hardening
- `backend-queue-system` for async file processing
- `backend-caching-system` when file metadata or derived assets need caching
- `backend-service-layer` for business rules after upload succeeds

# Adaptation Notes

Phan nay giup file upload system khop voi backend hien tai.
- Prefer small, explicit upload entrypoints.
- Keep upload validation strict.
- Separate file transport, storage, and business association clearly.
