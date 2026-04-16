# Config Normalization

Raw env values deu la string, nen can normalize truoc khi dung.

## Common Normalizations

- string to number
- string to boolean
- comma-separated string to array
- URL and host values kept explicit

## Guardrails

- Do not parse the same env value in many places.
- Keep normalization rules small and predictable.
