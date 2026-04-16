# Middleware Anti-Patterns

Day la cac dau hieu middleware dang lam qua nhieu viec.

## Anti-Patterns

- middleware runs complex business workflows
- middleware talks directly to many unrelated services
- middleware swallows errors instead of forwarding them
- middleware mutates many request fields with unclear ownership

## Refactor Direction

- move business branching to services
- move response serialization to controller or central response helpers
- keep middleware limited to request-boundary concerns
