# When To Queue

Khong phai nghiep vu nao cung nen xu ly dong bo trong request.

## Good Fit For Queueing

- email sending
- report or export generation
- notification fan-out
- file processing
- expensive side effects that do not need immediate UI result

## Usually Keep Synchronous

- simple validation
- direct CRUD writes that the user must see immediately
- tiny side effects tightly required for the immediate response

## Guardrails

- Do not block user requests on work that can safely happen later.
- Do not queue trivial work if synchronous handling is clearer and fast enough.
- Let services make the queue decision, not controllers alone.
