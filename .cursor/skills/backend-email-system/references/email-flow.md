# Email Flow

Luong xu ly email nen nhat quan de de trace va de mo rong.

## Outbound Flow

`business service -> mail payload builder -> optional queue -> mail service -> SMTP transport`

## Inbound Flow

`provider or SMTP-received event -> inbound handler -> service -> domain action`

## Preferred Rules

- Keep outbound email sending explicit in service flow.
- For non-urgent email, enqueue delivery instead of blocking the HTTP request.
- If inbound email exists, validate and normalize inbound payloads before domain logic runs.

## Guardrails

- Do not bury email side effects in random helpers.
- Do not mix template rendering into domain services.
