# Auth Flow

Tai lieu nay mo ta auth flow tong the cua backend.

## Typical Flow

1. user sends credentials to login endpoint
2. backend validates credentials
3. backend creates session state and issues JWT as appropriate
4. backend sets secure `httpOnly` cookies
5. frontend calls current-user or protected endpoints
6. backend resolves auth state and permissions
7. logout clears auth session and cookies

## Required Endpoints

- login
- logout
- refresh or session-renew endpoint if the auth model needs it
- current-user endpoint

## Guardrails

- Do not let protected route checks depend only on frontend state.
- Do not expose raw token internals in response payloads.
- Keep auth lifecycle predictable across the whole app.
