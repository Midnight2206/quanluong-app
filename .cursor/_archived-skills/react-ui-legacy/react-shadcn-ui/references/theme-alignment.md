# Theme Alignment

Shadcn/ui component phai doc cung mot he token voi Tailwind va `index.css`.

## Preferred Tokens

- background and surface: `background`, `card`, `popover`
- text: `foreground`, `muted-foreground`
- actions: `primary`, `secondary`, `accent`, `destructive`
- structure: `border`, `input`, `ring`, `radius`, shadow tokens

## Guardrails

- Keep component classes compatible with `html.dark`.
- Avoid per-component theme flags when the global theme already exists.
- Route all reusable visual decisions through shared tokens first.
