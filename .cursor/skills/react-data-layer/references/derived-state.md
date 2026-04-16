# Derived State

Derived state giup UI render don gian hon ma khong phai hieu raw payload.

## Good Candidates

- formatted status groups
- filtered option lists
- grouped summaries
- denormalized labels for tables and badges

## Good Practices

- keep derivations pure
- colocate derivations with the feature or selector layer
- prefer memoized selectors when derivation is shared or costly

## Guardrails

- Do not store trivially derivable values redundantly without a reason.
- Do not push formatting concerns into low-level API modules unless it is a contract mapping.
- Keep derived outputs stable and easy for the UI to consume.
