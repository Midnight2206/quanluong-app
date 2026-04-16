# Upload Security

File upload co rui ro bao mat cao hon request thong thuong.

## Preferred Practices

- generate safe server-side filenames
- keep strict file size limits
- keep allowed type allowlists
- scan or queue suspicious or heavy processing when needed

## Guardrails

- Do not execute uploaded files.
- Do not expose raw internal storage paths directly.
