# Error Classification

Tai lieu nay giup phan loai loi de chon dung cach xu ly.

## Use Global Error Handling For

- unrecoverable runtime failures
- session-expired or auth policy decisions
- app-wide outage states
- repeated shared errors that should be normalized centrally

## Use Toast For

- mutation success or failure feedback
- non-blocking request errors
- quick warnings the user can recover from immediately

## Use Fallback UI For

- render errors caught by error boundaries
- a section that cannot display due to broken data or missing prerequisites
- routes or widgets that need a safe replacement view

## Guardrails

- Do not show a toast and a full fallback for the same minor recoverable error by default.
- Do not treat every request failure as a global app error.
- Keep error severity and display strategy consistent across features.
