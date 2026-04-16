# Store Setup

Tai lieu nay mo ta cach lap store RTK cho app React.

## Core Pieces

1. root reducer or reducer map
2. middleware pipeline
3. optional dev tools configuration
4. typed hooks or shared selector helpers when the app uses TypeScript

## Guardrails

- Register slices by feature key, not by random file names.
- Keep middleware additions explicit and limited.
- Do not re-create the store inside render flows.
