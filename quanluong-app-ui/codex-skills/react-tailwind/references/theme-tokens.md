# Theme Tokens

Tai lieu nay quy dinh cach dat bien CSS de UI de doi mau va doi theme.

## Preferred Token Location

- declare shared tokens in `src/index.css`
- keep `:root` for default light theme values
- override the same tokens under `html.dark`

## Recommended Token Groups

- surface: `--background`, `--foreground`, `--card`, `--card-foreground`
- feedback: `--destructive`, `--warning`, `--success`
- brand: `--primary`, `--primary-foreground`, `--secondary`
- neutral helpers: `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`
- shape and effects: `--radius`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`

## Guardrails

- Prefer semantic tokens over direct palette names like `--blue-500`.
- Avoid inline `style` color values when a token can express the same meaning.
- Keep tokens global only when many components need them.
