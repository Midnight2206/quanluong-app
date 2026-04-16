# Controller Anti-Patterns

Day la nhung dau hieu controller dang lam qua nhieu viec.

## Anti-Patterns

- controller directly imports repository or ORM client
- controller contains many business `if/else` branches
- controller performs many writes to coordinate one use case
- controller duplicates validation already done elsewhere
- controller builds domain-specific side effects such as mail or audit publishing

## Refactor Direction

- move business branching to the service layer
- move persistence to repositories
- move validation to validation middleware or schemas
- keep only HTTP-specific concerns in the controller
