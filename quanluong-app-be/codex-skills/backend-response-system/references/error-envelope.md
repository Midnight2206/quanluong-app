# Error Envelope

Error response can co shape on dinh va an toan.

## Recommended Shape

```json
{
  "success": false,
  "message": "Request could not be completed.",
  "error": {
    "code": "SOME_ERROR_CODE"
  }
}
```

## Good Practices

- keep the message concise and safe
- keep machine-readable error codes stable
- include `details` only when safe and intentionally exposed

## Guardrails

- Do not leak stack traces or internal SQL details.
- Do not expose overly specific auth, DB, or system internals in public messages.
- Keep unknown failures generic from the client's perspective.
