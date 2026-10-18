# Component Customization

Tai lieu nay mo ta cach custom component shadcn/ui ma khong lam vo design system.

## Preferred Approach

- start from a shared primitive such as Button, Input, Dialog, Card, or Sheet
- layer variants on top of semantic tokens
- keep Radix behavior intact while changing presentation through classes

## Guardrails

- Do not hard-code theme colors directly inside variants.
- Do not clone almost-identical components for small visual changes.
- Prefer adding variants or wrapper components over duplicating the primitive.
