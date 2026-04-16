# Controller Response Boundary

Controller chi nen chon success response va throw hoac `next` error cho central layer.

## Allowed Work

- send unified success response
- pass thrown or caught errors to `next(error)`
- choose a valid success status code

## Avoid

- hand-building many different response envelopes
- catching errors only to swallow them
- serializing unexpected errors directly in controllers

## Guardrails

- Let the centralized error handler own all error serialization.
- Keep controller success responses thin and predictable.
- Throw or forward all failures instead of hiding them.
