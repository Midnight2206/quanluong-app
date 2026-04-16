# Success Envelope

Success response nen co mot shape on dinh de client de tieu thu.

## Recommended Shape

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {},
  "meta": {}
}
```

## Good Practices

- keep `success` explicit
- keep `data` stable and predictable
- use `meta` for pagination or extra context when needed

## Guardrails

- Do not return wildly different top-level success shapes between endpoints.
- Do not mix transport metadata directly into `data` if `meta` is more appropriate.
