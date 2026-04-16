# Route Types

Tai lieu nay quy dinh cac loai route trong app.

## Public Route

- accessible without login
- examples: login, forgot password, public landing page

## Private Route

- requires authenticated session
- does not require a specific permission beyond being logged in

## Protected Route

- requires authenticated session
- also requires one or more permissions or capabilities

## Guardrails

- Do not use one route wrapper for every case if the access model differs.
- Keep the distinction between "logged in" and "authorized" explicit.
- Reuse route wrappers rather than repeating redirects in pages.
