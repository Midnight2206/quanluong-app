---
name: react-redux
description: Build or update React state management with Redux store, reducer, actions, selectors, feature-level state boundaries, and predictable unidirectional data flow.
---

# Purpose

Dung skill nay khi bai toan can Redux theo kieu co ban hoac can giai thich boundary cua global state.
Use this skill when the task involves:

- Redux store structure
- reducers, actions, and selectors
- feature-level global state
- predictable state transitions
- migrating ad-hoc shared state into Redux

# Rules

Skill nay tap trung vao model Redux nen khong mac dinh dung RTK neu user chua yeu cau.
- Keep state normalized and feature-oriented where practical.
- Do not move transient UI state into Redux without a clear reason.
- Keep reducers pure and side effects outside reducers.
- Expose state through selectors instead of deep component access.
- Reuse the app's existing module boundaries before inventing new ones.

# Workflow

Doc reference theo nhu cau cua task.
1. Read [references/state-architecture.md](references/state-architecture.md) when designing global state boundaries.
2. Read [references/module-shape.md](references/module-shape.md) when creating a Redux feature module.
3. Reuse [templates/module.js](templates/module.js) as a baseline for plain Redux modules.
4. Use [examples/usage.js](examples/usage.js) when wiring selectors and dispatch calls in React.

# Adaptation Notes

Phan nay giup dieu chinh skill cho codebase hien tai.
- Prefer `react-redux-toolkit` if the team already uses RTK broadly.
- Keep plain Redux only when the project already uses it or the task explicitly asks for it.
- Adapt naming, folder structure, and middleware strategy to the app's current conventions.
