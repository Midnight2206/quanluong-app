# Permission Filtering

Permission filtering dung de an route, menu, hoac page ma user khong duoc phep truy cap.

## Typical Uses

- sidebar navigation
- page registry
- route objects before rendering
- action links leading to protected pages

## Recommended Rule

- filter route definitions by permission before rendering navigation
- still keep runtime route guards for safety
- use one shared permission helper instead of inline string comparisons

## Guardrails

- Hiding a route in navigation is not a substitute for runtime protection.
- Do not expose links to pages the user cannot access.
- Keep route metadata explicit, such as `requiredPermission`.
