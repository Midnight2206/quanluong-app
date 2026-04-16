# Component Layers

Tai lieu nay quy dinh cac lop component trong UI system.

## Recommended Layers

- `components/ui/`: primitives such as Button, Input, Dialog, Tabs, Badge
- `components/common/`: shared composed pieces such as PageHeader, EmptyStateCard, ConfirmDialog
- `features/<name>/components/`: feature-local UI pieces tied to one domain
- `pages/`: top-level composition only

## Good Practices

- keep primitives generic
- keep shared composed components intention-revealing
- keep feature components close to their domain

## Guardrails

- Do not place business logic in global primitives.
- Do not promote one-off layouts to global shared scope.
- Keep page files thin and compositional.
