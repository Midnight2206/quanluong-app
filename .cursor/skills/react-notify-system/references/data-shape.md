# Notification Data Shape

Notification nen co mot payload on dinh de UI va state layer de xu ly.

## Recommended Fields

- `id`
- `title`
- `message`
- `severity`
- `createdAt`
- `isRead`
- `actionLabel`
- `actionHref` or `actionHandlerKey`
- `source`

## Severity Levels

- `info`
- `success`
- `warning`
- `error`

## Guardrails

- Normalize server payloads before rendering.
- Keep UI components independent from raw backend field names.
- Use stable ids so read state is predictable.
