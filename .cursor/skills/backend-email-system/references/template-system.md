# Template System

He thong template email nen thong nhat de nhieu nghiep vu tai su dung duoc.

## Preferred Structure

- one shared layout wrapper
- one consistent header, body, and footer shape
- per-use-case content blocks
- optional text fallback for important emails

## Typical Use Cases

- account verification
- password reset
- welcome email
- payroll notification
- approval notification

## Guardrails

- Keep branding and layout tokens centralized.
- Keep dynamic content explicit and parameterized.
- Do not duplicate full HTML structure across many business emails.
