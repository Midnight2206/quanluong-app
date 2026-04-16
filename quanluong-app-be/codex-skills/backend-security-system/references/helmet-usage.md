# Helmet Usage

Helmet giup thiet lap cac HTTP security headers co ich cho Express app.

## Preferred Practices

- enable Helmet near the app bootstrap layer
- keep policy overrides explicit when a feature truly needs them
- review CSP-related needs separately if the app serves frontend assets directly

## Guardrails

- Do not disable Helmet broadly without a concrete reason.
- Keep exceptions small and documented.
