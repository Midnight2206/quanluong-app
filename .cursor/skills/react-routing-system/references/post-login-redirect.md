# Post-Login Redirect

Neu user truy cap mot route can dang nhap khi chua auth, app can nho dich den do.

## Recommended Flow

1. user opens a private or protected route
2. app redirects to `/login`
3. app stores the intended path in router state
4. after login succeeds, app reads that stored location
5. app navigates the user back to the intended path

## Good Practices

- use `location.state.from`
- fallback to a safe default route if no intended route exists
- replace history entries when redirecting to avoid broken back navigation

## Guardrails

- Do not lose the user's intended route on forced login.
- Do not redirect back to login after a successful login.
- Keep redirect logic inside auth or routing orchestration, not deep in form fields.
