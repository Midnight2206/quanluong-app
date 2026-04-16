# Component Extraction

Tai lieu nay dua ra rule tach component de file khong bi qua dai va kho doc.

## Extraction Triggers

- a component grows past roughly 500 lines
- JSX nesting becomes hard to scan
- one file mixes layout, state orchestration, and many subviews
- a subview appears in two or more places
- a block has its own props and rendering logic

## Preferred Extraction Order

1. extract small presentational subcomponents first
2. extract repeated hooks or helpers next
3. extract feature-scoped shared components before promoting to global `components/`
4. extract shared layout wrappers only when many screens need them

## Reuse Rule

Neu mot component duoc dung tu hai lan tro len, hay tach no ra de tai su dung.
If a component is used in two or more places, extract it into a reusable module at the narrowest shared scope that makes sense.

## Guardrails

- Do not split files mechanically if the resulting abstraction is harder to understand.
- Prefer feature-local reuse before app-wide reuse.
- Keep prop APIs small and intentional after extraction.
