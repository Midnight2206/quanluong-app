# SMTP And Security

SMTP can duoc cau hinh an toan va de thay doi theo moi truong.

## Preferred Practices

- read SMTP host, port, user, and password from environment variables
- keep secure transport flags configurable by environment
- log delivery outcomes safely without exposing credentials or full secrets
- keep reset tokens and verification tokens short-lived and purpose-specific

## Guardrails

- Do not hardcode SMTP credentials.
- Do not log raw passwords, secrets, or long-lived tokens.
- Do not expose internal mail transport failures directly to end users.
