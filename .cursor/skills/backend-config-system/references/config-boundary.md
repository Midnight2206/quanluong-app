# Config Boundary

Config la lop runtime support, khong phai business logic.

## Preferred Rules

- read env once in the config layer
- export normalized config objects
- consume config through imports, not repeated env parsing

## Guardrails

- Do not scatter `process.env` across services and controllers.
- Keep config separate from domain rules.
