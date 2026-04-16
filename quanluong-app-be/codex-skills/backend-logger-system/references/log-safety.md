# Log Safety

Log phai ho tro debug ma van giu an toan.

## Never Log

- passwords
- raw tokens
- secrets
- cookies
- full personal payloads when not needed

## Preferred Practices

- log identifiers, not full secret-bearing objects
- mask or omit sensitive fields
- keep public and internal error messages separate
