# Error Normalization

Backend errors can duoc chuan hoa truoc khi len UI layer.

## Typical Output

- `code`
- `message`
- `status`
- optional `details`

## Good Practices

- map known backend errors into stable app-facing shapes
- preserve status codes when useful for policy decisions
- keep raw transport details out of presentational components

## Guardrails

- Do not throw wildly inconsistent error objects.
- Do not parse backend error payloads repeatedly in many screens.
- Keep normalization logic centralized per API module or shared adapter.
