# Rate Limit

Rate limiting giup giam brute-force, spam, va abuse tren endpoint.

## Good Targets

- login
- forgot password
- OTP verification
- public search
- public API endpoints with abuse risk

## Preferred Rules

- keep limiter windows and max requests explicit
- use stricter limits on auth-related endpoints
- keep response messages generic and safe
- trust proxy config should be reviewed when deploying behind reverse proxies

## Guardrails

- Do not apply one global limiter blindly to every route without considering UX and business flow.
- Do not leak detailed rate-limit internals in public messages.
