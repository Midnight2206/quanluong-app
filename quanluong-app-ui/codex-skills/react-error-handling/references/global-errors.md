# Global Errors

Global error layer dung de ap policy chung cho toan app.

## Typical Responsibilities

- normalize unknown errors
- log or report important failures
- coordinate auth/session expiration handling
- expose app-level outage or fatal-error state if needed

## Good Fit

- top-level providers
- shared error adapters near the transport layer
- app shell or router-level boundaries

## Guardrails

- Do not push every feature error into a global store.
- Keep the global layer small and policy-oriented.
- Avoid tightly coupling UI rendering to raw error objects.
