# Reuse Rules

Tai lieu nay quy dinh khi nao nen tach shadcn/ui composition thanh component dung chung.

## Extract When

- the same composed UI block appears in two or more places
- a primitive gets wrapped with the same classes repeatedly
- a card, toolbar, or empty state pattern repeats across features

## Keep Local When

- the composition is specific to one feature
- the abstraction would hide important business behavior

## Guardrails

- Shared primitives go to `components/ui/`.
- Shared composed patterns go to `components/common/` or another clear shared folder.
- Feature-only compositions stay inside `features/<name>/components/`.
