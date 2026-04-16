# Refresh Token Flow

File này mô tả cách interceptor quyết định refresh và retry khi gặp `401`.
When an API request fails with `401`, the shared client should decide whether the request is eligible for refresh and retry.

## Expected Flow

Chỉ nên có một refresh request chạy tại một thời điểm.
1. Original request returns `401`.
2. Ignore refresh for auth endpoints like login or refresh itself.
3. If no refresh is in progress, call `/auth/refresh`.
4. While refresh is in progress, queue other eligible requests.
5. If refresh succeeds, resolve the queue and retry the original requests.
6. If refresh fails, reject the queue and transition to the centralized logout flow.

## Guardrails

Các guardrail này giúp tránh loop vô hạn và race condition.
- Allow only one refresh request at a time.
- Mark retried requests to avoid infinite loops.
- Support an explicit opt-out such as `skipRefresh` for endpoints that must not retry.
