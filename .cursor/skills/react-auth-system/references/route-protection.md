# Route Protection

Protected routes ngan user chua du dieu kien vao cac khu vuc nhay cam.

## Recommended States

- auth unknown: show guarded loading UI
- unauthenticated: redirect to login
- authenticated but unauthorized: show denied or fallback UI
- authenticated and authorized: render content

## Good Practices

- protect at route or layout boundaries first
- add finer-grained feature checks only where needed
- keep denied UI calm and informative

## Guardrails

- Do not redirect before bootstrap finishes.
- Do not hide unauthorized content only with CSS.
- Keep route protection logic reusable instead of duplicating it in every page.
