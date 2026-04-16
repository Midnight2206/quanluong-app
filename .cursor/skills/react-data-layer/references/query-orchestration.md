# Query Orchestration

Data layer nen dieu phoi query theo nhu cau cua screen thay vi de page tu ghep.

## Typical Responsibilities

- list and detail query coordination
- dependency between params and fetches
- pagination state integration
- filter and sort param projection

## Good Practices

- expose one feature hook or selector set per screen need
- keep orchestration close to the feature
- return stable booleans and data shapes to the UI

## Guardrails

- Do not make pages manually coordinate too many independent query pieces.
- Do not expose raw cache structure when a cleaner adapter can be returned.
- Keep feature query logic discoverable and reusable.
