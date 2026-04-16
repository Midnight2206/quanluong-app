# Guard Middleware

Guard middleware duoc dung de chan request khong hop le truoc khi vao controller.

## Typical Guards

- authentication guard
- permission guard
- feature-flag or environment gate

## Guardrails

- Keep guards focused on yes-or-no access decisions.
- Delegate detailed business rules to services.
- Throw or forward safe auth and permission errors to the central error layer.
