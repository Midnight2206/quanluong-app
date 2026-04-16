# Route Configuration

Route config nen co metadata du de auth va permission logic tai su dung.

## Recommended Metadata

- `path`
- `element`
- `isPrivate`
- `requiredPermission`
- `showInNav`
- `label`

## Good Practices

- define route metadata close to the router setup
- use filtered route lists for navigation rendering
- keep page components focused on UI, not access control plumbing

## Guardrails

- Do not hard-code access logic separately in router config and nav config if one source can drive both.
- Avoid deeply nested ad-hoc route objects with inconsistent metadata.
- Keep route definitions readable and explicit.
