# JWT Session Cookies

Project nay su dung ket hop `JWT + session + httpOnly cookies` de tang do an toan va kiem soat.

## Recommended Responsibilities

- session stores trusted server-side session context
- JWT carries signed identity or access context where needed
- `httpOnly` cookies transport session or refresh-related secrets securely

## Good Practices

- keep cookies `httpOnly`
- use secure cookie settings appropriate to environment
- keep JWT signing and verification centralized
- treat refresh or renewal as a controlled server-side flow

## Guardrails

- Do not store security-sensitive tokens in localStorage by default.
- Do not let JWT verification logic spread across many unrelated files.
- Keep session invalidation and logout behavior centralized.
