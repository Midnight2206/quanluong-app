# Tailwind Usage

Tailwind nen duoc dung cung token system thay vi hard-code gia tri truc tiep.

## Prefer

- semantic utility classes wired to CSS variables
- reusable class compositions for repeated patterns
- feature-local class composition before global abstraction

## Avoid

- repeated raw hex colors
- repeated arbitrary values without a token or clear need
- mixing many unrelated visual decisions directly inside page-level files

## Guardrails

- Keep visual primitives consistent across screens.
- If the same class set appears in two or more places, consider extracting a shared component or utility.
- Let tokens drive the theme, and let Tailwind utilities consume those tokens.
