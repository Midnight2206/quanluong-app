# Safe Payloads

Audit payload can du chi tiet de trace nhung khong duoc lo thong tin nhay cam.

## Avoid Logging

- passwords
- tokens
- cookie values
- full secret configs
- raw personal data beyond what policy allows

## Prefer Logging

- ids
- codes
- summarized field changes
- safe metadata needed for investigations

## Guardrails

- Treat audit payload design as a security decision.
- Keep logs useful without exposing secrets.
- Review metadata fields carefully before storing them.
