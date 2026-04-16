# Controller Responsibility

Controller la lop boundary cua HTTP trong Express backend.

## Good Fit

- receive request data already validated or easy to read
- call the correct service method
- choose the correct HTTP status code
- serialize the service result into response shape

## Not A Good Fit

- business branching
- repository or database calls
- transaction management
- cross-service orchestration logic that belongs to use-case services

## Guardrails

- Keep controllers thin and predictable.
- Keep one controller method focused on one HTTP action.
- Let services decide business outcomes.
