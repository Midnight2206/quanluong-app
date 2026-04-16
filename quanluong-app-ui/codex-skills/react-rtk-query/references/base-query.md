# Base Query

`baseQuery` la noi RTK Query ket noi voi transport layer thuc te cua app.

## Typical Options

- `fetchBaseQuery` for simple projects
- custom axios base query when the app already has interceptors, refresh token logic, or shared error handling

## Guardrails

- Reuse the app's shared HTTP client when it already encapsulates auth behavior.
- Return RTK Query shaped `{ data }` or `{ error }` objects consistently.
- Keep endpoint files free from repeated auth and serialization boilerplate.
