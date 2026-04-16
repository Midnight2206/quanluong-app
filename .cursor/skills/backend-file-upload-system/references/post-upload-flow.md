# Post Upload Flow

Nhieu upload can xu ly tiep sau khi da luu file.

## Typical Follow-up Work

- image resize
- thumbnail generation
- virus scan
- metadata extraction
- notification or audit events

## Guardrails

- If post-upload work is heavy, enqueue it.
- Keep upload success separate from long-running post-processing.
