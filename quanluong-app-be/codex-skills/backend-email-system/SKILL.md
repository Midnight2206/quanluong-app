---
name: backend-email-system
description: Build or refactor email handling in a Node.js Express JavaScript backend using SMTP, reusable email templates, centralized mail sending flow, and queue-friendly processing for business email workflows.
---

# Purpose

Dung skill nay khi task lien quan den gui mail, nhan mail, hoac chuan hoa email workflow o backend.
Use this skill when the task involves:

- SMTP email sending
- reusable email templates
- transactional email workflows
- email verification, password reset, notification emails
- inbound or outbound mail-related processing
- queueing email delivery jobs

# Rules

Skill nay chuan hoa he thong email cho backend.
- Use `SMTP` as the default email transport term and integration boundary.
- Keep one centralized mail service for sending email.
- Reuse one consistent email template structure across business flows.
- Keep email composition separate from business orchestration.
- Services decide when an email should be sent, but template rendering and transport stay in the email layer.
- Prefer queue-based email sending for work that does not need an immediate HTTP result.
- Keep email payloads and logs safe; never leak secrets or sensitive tokens unnecessarily.

# Workflow

Doc reference theo dung bai toan email.
1. Read [references/email-boundary.md](references/email-boundary.md) when deciding what belongs in the email layer.
2. Read [references/template-system.md](references/template-system.md) when creating reusable email templates or shared email form layouts.
3. Read [references/email-flow.md](references/email-flow.md) when wiring business services to outbound or inbound email processing.
4. Read [references/smtp-and-security.md](references/smtp-and-security.md) when handling SMTP config, credentials, and safe logging.
5. Read [references/queue-integration.md](references/queue-integration.md) when email delivery should happen asynchronously.
6. Reuse [templates/mail-service.js](templates/mail-service.js), [templates/email-template.js](templates/email-template.js), and [templates/email-job.js](templates/email-job.js) as the baseline.
7. Use [examples/reset-password-email.js](examples/reset-password-email.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-queue-system` for background email delivery
- `backend-schedule-system` for automatic email campaigns or reminders
- `backend-auth-system` for verification and password-reset mail flows
- `backend-service-layer` for deciding when business flows trigger email
- `backend-error-handling` for transport and processing failures

# Adaptation Notes

Phan nay giup email system khop voi backend hien tai.
- Prefer one mail transport adapter and many reusable templates.
- Keep email HTML or text templates structurally consistent across use cases.
- If the project later needs a provider API, keep the same centralized mail boundary and swap transport behind it.
- Inbound mail handling should be explicit and limited to the use cases the project truly needs.
