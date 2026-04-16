# Session Policy

Session policy quy dinh app phan ung the nao khi phien dang nhap thay doi.

## Typical Behaviors

- initialize auth state on app start
- react to session expiration
- redirect to login after centralized logout
- preserve or restore intended route when appropriate

## Good Practices

- keep one logout path
- centralize session-expired handling
- separate transient request errors from true session loss

## Guardrails

- Do not logout from many unrelated components.
- Do not treat every failed request as session expiration.
- Keep redirect behavior stable and explicit.
