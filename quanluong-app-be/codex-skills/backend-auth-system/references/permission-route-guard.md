# Permission Route Guard

Permission system phai gan lien voi route de user khong lot vao route khong co quyen.

## Recommended Approach

- authenticate request first
- attach current user and permissions to request context
- check required permission in route-level middleware
- reject access with `403` when authenticated but not authorized

## Good Practices

- define permissions as explicit capability strings
- keep route metadata or middleware arguments readable
- reuse one permission-check helper across modules

## Guardrails

- Do not depend only on hidden frontend routes for access control.
- Do not sprinkle raw role string checks in every controller.
- Keep route protection centralized and reusable.
