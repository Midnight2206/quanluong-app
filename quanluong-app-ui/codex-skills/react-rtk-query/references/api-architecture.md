# API Architecture

Tai lieu nay mo ta cach to chuc RTK Query de de inject endpoint va quan ly domain.

## Recommended Structure

1. one shared base API
2. feature endpoint files that inject endpoints
3. store registration in one predictable place

## Guardrails

- Do not create many unrelated `createApi` instances unless there is a strong reason.
- Prefer domain-based endpoint files such as `usersApi`, `rolesApi`, or `payrollApi`.
- Keep transport configuration in the base layer, not duplicated in every endpoint.
