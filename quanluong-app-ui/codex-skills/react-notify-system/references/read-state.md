# Read State

Read state la phan trung tam cua notify system neu app co notification center.

## Typical Behaviors

- compute unread count
- mark one notification as read
- mark all as read
- optionally remove or archive notifications

## Placement

- shared store or feature-level store if many screens need it
- sync with backend when notifications are persisted server-side

## Guardrails

- Keep unread count derived from notification data when possible.
- Do not maintain separate unread counters that drift from the list.
- Keep optimistic updates simple and reversible.
