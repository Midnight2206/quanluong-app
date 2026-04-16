# Async Thunk

Su dung `createAsyncThunk` cho cac flow async mang tinh imperative, dac biet khi can status state ro rang.

## Good Use Cases

- submit form then show pending/success/error state
- one-off bootstrap requests
- chained async actions with custom branching

## Avoid When

- the task is standard API caching or normalized server data
- `react-rtk-query` already owns the endpoint lifecycle

## Guardrails

- Keep payload creators thin and focused.
- Map API errors into predictable slice state.
- Do not duplicate the same server endpoint in both thunk logic and `react-rtk-query` without a reason.
