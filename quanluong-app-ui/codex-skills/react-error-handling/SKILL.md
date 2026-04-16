---
name: react-error-handling
description: Build or refactor React error handling with global error policies, toast notifications, fallback UI boundaries, and clear separation between recoverable user-facing failures and unrecoverable application errors.
---

# Purpose

Dung skill nay khi task lien quan den xu ly loi trong React app o muc global, feature, hoac UI feedback.
Use this skill when the task involves:

- global error handling
- toast notifications
- fallback UI
- error boundaries
- request error normalization
- recoverable versus unrecoverable failures

# Rules

Skill nay tach ro error theo muc do va cach hien thi.
- Use global error handling for unrecoverable app-wide failures or shared policy decisions.
- Use toasts for short-lived, recoverable user-facing feedback.
- Use fallback UI for render failures, broken sections, or blocked content areas.
- Do not show the same failure in multiple layers unless the UX explicitly requires it.
- Normalize request errors before UI layers consume them.
- Keep raw error parsing out of presentational components whenever possible.

# Workflow

Doc reference truoc khi chon cach xu ly loi.
1. Read [references/error-classification.md](references/error-classification.md) to decide whether the error belongs to global policy, toast, or fallback UI.
2. Read [references/global-errors.md](references/global-errors.md) when the app needs a shared error store or centralized handler.
3. Read [references/toast-usage.md](references/toast-usage.md) when the task needs user feedback for actions or request outcomes.
4. Read [references/fallback-ui.md](references/fallback-ui.md) when protecting routes, sections, or widgets from render failures.
5. Reuse [templates/error-boundary.jsx](templates/error-boundary.jsx), [templates/error-handler.js](templates/error-handler.js), and [templates/toast-adapter.js](templates/toast-adapter.js) as the default baseline.
6. Use [examples/page-fallback.jsx](examples/page-fallback.jsx) and [examples/request-toast.js](examples/request-toast.js) as integration references.

# Adaptation Notes

Phan nay giup error policy khop voi architecture cua du an.
- Keep error classification rules stable across the app so teams do not invent per-feature behavior.
- If the project already has a toast library, wrap it in a small adapter instead of calling it everywhere directly.
- Route auth/session expiration through the shared auth or HTTP client policy instead of sprinkling logout behavior in feature code.
