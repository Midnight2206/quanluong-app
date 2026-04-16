# Input Sanitization

Sanitization giup lam sach input truoc khi validation va business logic xu ly.

## Preferred Practices

- remove dangerous prototype-pollution style keys such as `__proto__`, `constructor`, and `prototype`
- trim or normalize obvious string input where appropriate
- sanitize `req.body`, `req.query`, and `req.params`
- run Zod validation after sanitization

## Guardrails

- Sanitization does not replace validation.
- Do not mutate payload shape in surprising ways without clear policy.
- Do not trust sanitized input as automatically safe for every downstream context.
