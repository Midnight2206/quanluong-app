---
name: react-redux-toolkit
description: Build or update React state management with Redux Toolkit using configureStore, createSlice, createAsyncThunk, typed selectors, feature slices, and scalable store setup.
---

# Purpose

Dung skill nay khi task noi ro Redux Toolkit hoac can nang cap plain Redux len RTK.
Use this skill when the task involves:

- `configureStore`
- `createSlice`
- `createAsyncThunk`
- feature slices
- scalable React store setup

# Rules

Redux Toolkit la default tot hon plain Redux trong phan lon app moi.
- Prefer `createSlice` over handwritten action-type boilerplate.
- Keep each slice focused on one feature concern.
- Use `createAsyncThunk` for imperative async flows that are not better served by `react-rtk-query`.
- Do not put server-cache concerns here if `react-rtk-query` should own them.
- Keep selectors and reducer exports stable for feature reuse.

# Workflow

Doc dung reference de tranh dung RTK sai boundary.
1. Read [references/store-setup.md](references/store-setup.md) when wiring the app store and middleware.
2. Read [references/slice-pattern.md](references/slice-pattern.md) when creating or updating feature slices.
3. Read [references/async-thunk.md](references/async-thunk.md) when the task needs async mutations or imperative fetch flows.
4. Reuse [templates/store.js](templates/store.js) and [templates/slice.js](templates/slice.js) as the baseline implementation.
5. Use [examples/usage.js](examples/usage.js) for component-level selector and dispatch patterns.

# Adaptation Notes

Can tach ro state cuc bo, global UI state, va server cache.
- If the app already uses `react-rtk-query`, keep cached API data there and reserve RTK slices for client state and orchestration.
- Add app-specific middleware only when there is a concrete need.
- Rename slice keys and file paths to match the feature structure already used in the project.
