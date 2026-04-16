# Email Boundary

Email layer can duoc tach ro de business flow khong bi tron voi transport details.

## What Belongs In The Email Layer

- SMTP transport setup
- template rendering
- mail payload shaping
- send helpers
- queue job handler for email delivery

## What Stays Outside

- business rules for when to send email
- permission decisions
- HTTP request and response handling
- unrelated domain orchestration

## Guardrails

- Services decide that an email should be sent.
- Mail service decides how the email is rendered and transported.
- Do not call SMTP directly from controllers.
