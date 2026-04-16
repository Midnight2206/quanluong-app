# Frontend Alignment

Backend can tra ve auth payload phu hop voi `react-auth-system` va `react-routing-system` da xay o frontend.

## Recommended Current User Shape

```json
{
  "id": 1,
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "roles": ["admin"],
  "permissions": ["users.read", "users.update", "payroll.manage"]
}
```

## Why This Matters

- frontend `react-auth-system` can hydrate current-user state directly
- frontend `react-routing-system` can filter routes and guards by `permissions`
- permission checks stay explicit across client and server

## Guardrails

- Keep permission names stable.
- Do not return a vague role-only payload if the frontend depends on permissions.
- Keep current-user output free from sensitive internal auth fields.
