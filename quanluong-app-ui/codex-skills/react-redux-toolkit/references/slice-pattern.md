# Slice Pattern

Slice la don vi chinh de dong goi state, reducer, va action cua mot feature.

## Recommended Shape

1. slice name
2. initial state
3. reducers for sync updates
4. extraReducers for async lifecycle handling
5. selectors exported near the slice or in a sibling module

## Guardrails

- Keep reducer names event-oriented and domain-specific.
- Avoid one monolithic `appSlice` for unrelated concerns.
- Prefer selectors over direct component knowledge of state shape.
