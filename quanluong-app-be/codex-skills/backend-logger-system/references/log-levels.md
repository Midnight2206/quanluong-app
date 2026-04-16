# Log Levels

Log level can phan biet muc do quan trong cua su kien.

## Suggested Usage

- `debug`: local troubleshooting and low-level details
- `info`: normal lifecycle events
- `warn`: suspicious or degraded behavior
- `error`: failures that need attention

## Guardrails

- Do not log normal success paths at `error`.
- Keep production `debug` usage deliberate.
