# Data Layer Integration

UI state nen doc tu data layer theo mot mapping ro rang.

## Typical Mapping

- `isLoading` and no data: initial loading
- `isFetching` and existing data: background refresh
- success with empty list: empty state
- failed request: error state

## With RTK Query

- use `isLoading` for first load
- use `isFetching` for refresh indicators
- use `data?.length === 0` or equivalent for empty state

## Guardrails

- Do not infer all states from one boolean.
- Normalize API response shapes before screen rendering when needed.
- Keep this mapping close to the container or section that owns the data.
