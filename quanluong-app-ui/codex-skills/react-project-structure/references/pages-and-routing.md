# Pages And Routing

Pages la route-level entry points, khong phai noi chua tat ca logic cua business flow.

## Recommended Responsibilities

- receive route params
- assemble layout and feature modules
- trigger page-level guards or data preload when needed
- coordinate page title, breadcrumbs, or route metadata

## Keep Out Of Pages

- large reusable subcomponents
- deeply nested form sections that belong to a feature
- repeated fetch and mutation logic that belongs in hooks, services, or data layers

## Guardrails

- Keep pages thin and compositional.
- Prefer feature containers and shared layout pieces over page files that do everything.
- When a page grows too large, extract sections into feature-level components first.
