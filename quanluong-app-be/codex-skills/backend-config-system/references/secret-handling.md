# Secret Handling

Secret la config dac biet can duoc xu ly can than.

## Preferred Practices

- keep secrets outside source control
- inject through environment variables or secret managers
- avoid logging secret values

## Guardrails

- Do not hardcode credentials.
- Do not expose secrets in error messages or debug logs.
