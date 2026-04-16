# Session Handling

Mục tiêu là gom toàn bộ logout behavior về một nơi để app phản ứng đồng nhất.
Centralize logout behavior so the app reacts consistently when the session expires.

## Trigger Conditions

Đây là các tình huống nên xem session là không còn hợp lệ.
- Refresh token request fails with an unrecoverable auth response.
- The backend indicates the session is no longer valid.

## Expected Actions

Khi session hết hạn, app nên làm đủ ba việc dưới đây.
1. Clear only auth-related client state.
2. Broadcast a logout signal so other tabs can react.
3. Redirect the user to the login route or entry auth route.

## Guardrails

Không nên để mỗi page hoặc component tự logout theo cách riêng.
- Do not scatter logout logic across many components.
- Do not clear unrelated user preferences unless the product explicitly requires it.
- Prefer a shared event name or storage signal for cross-tab synchronization.
