# Theme Provider Note

Shadcn/ui component trong du an nay khong tu quan ly dark mode.

- Theme state lives in `localStorage`.
- The active mode is applied by toggling the `dark` class on `document.documentElement`.
- Components should assume tokens from `index.css` are already available.
- If a provider or hook is needed, it should wrap the same shared theme helpers used by the Tailwind skill.
