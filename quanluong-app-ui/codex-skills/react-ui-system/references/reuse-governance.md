# Reuse Governance

Khong phai component nao cung nen dua len shared scope.

## Promote To Shared When

- the same visual pattern appears in two or more features
- the abstraction keeps naming and props clearer
- the component expresses a stable concept such as `PageHeader` or `SectionCard`

## Keep Local When

- the UI block only belongs to one feature
- the abstraction would hide domain meaning
- the prop API becomes awkward just to force reuse

## Guardrails

- Prefer narrow, meaningful reuse over generic mega-components.
- Split giant shared components before they become a dumping ground.
- Keep shared APIs small and intention-revealing.
