# Auth Flow

Tai lieu nay mo ta auth flow tong the cua app.

## Typical Flow

1. user submits login credentials
2. server creates or refreshes authenticated session
3. app loads current-user data
4. protected routes render only after auth state is known
5. logout clears auth state and redirects to the login entry point

## Core Pieces

- login action or mutation
- current-user bootstrap
- logout action
- authenticated versus unauthenticated state

## Guardrails

- Do not let protected UI render before auth state is resolved.
- Do not spread current-user bootstrap logic across many screens.
- Keep auth flow predictable across the whole app.
