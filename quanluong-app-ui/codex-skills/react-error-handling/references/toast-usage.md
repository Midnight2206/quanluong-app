# Toast Usage

Toast dung cho feedback ngan gon, phuc hoi duoc, va khong chan toan bo man hinh.

## Good Fit

- save succeeded
- save failed but the user can retry
- validation-adjacent server warnings
- network hiccups that do not break the whole screen

## Avoid

- repeated noisy background errors
- fatal render failures
- long, complex troubleshooting content

## Guardrails

- Wrap the chosen toast library in a shared adapter.
- Keep messages short, actionable, and non-duplicative.
- Avoid firing multiple toasts for one failure chain.
