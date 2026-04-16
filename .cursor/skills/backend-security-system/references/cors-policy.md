# CORS Policy

CORS can duoc khai bao ro rang theo frontend duoc phep truy cap.

## Preferred Practices

- use origin allowlists
- configure credentials explicitly when cookies or sessions are used
- allow only needed methods and headers
- separate local development origins from production origins

## Guardrails

- Do not default to `*` when credentials are involved.
- Do not mix permissive local rules into production accidentally.
- Keep frontend origin configuration environment-driven.
