# Dark Mode

Dark mode trong du an nay duoc dieu khien boi class `dark` tren the `html`.

## Required Behavior

1. read the saved mode from `localStorage`
2. apply or remove the `dark` class on `document.documentElement`
3. expose a small API or hook for toggle actions
4. keep the current mode synchronized after user changes it

## Persistence

- use a stable key such as `app:theme`
- store a string like `light` or `dark`

## Guardrails

- Do not manage dark mode by scattering inline DOM manipulation across components.
- Do not rely on per-component class toggles for the global theme.
- Keep theme initialization close to app bootstrap when possible.
