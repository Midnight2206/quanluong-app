# Request And Response Mapping

Mapping giup app khong bi khoa chat vao field names hoac shape cua backend.

## Recommended Responsibilities

- request payload shaping
- response field adaptation
- DTO to view-model friendly normalization

## Good Practices

- keep mapping explicit when backend naming differs
- map nested backend shapes into stable app-level shapes
- avoid forcing UI components to understand transport quirks

## Guardrails

- Do not let backend response shape leak everywhere.
- Do not mix view rendering concerns into mapping code.
- Keep mappings close to the resource module that owns them.
