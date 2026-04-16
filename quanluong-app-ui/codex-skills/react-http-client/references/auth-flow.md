# Auth Flow

Luồng này mô tả cách app xử lý cookie-based authentication theo kiểu tập trung.
1. User logs in.
2. Server stores access and refresh credentials in cookies.
3. Client sends API requests with `withCredentials: true`.
4. If the access credential expires, the API returns `401`.
5. The shared client calls `/auth/refresh`.
6. If refresh succeeds, retry the original request.
7. If refresh fails, treat the session as expired and run the centralized logout flow.

## Guardrails

Cac giới hạn này giúp tránh auth logic bị phân tán.
- Do not store the refresh token in `localStorage`.
- Do not implement auth recovery logic inside individual components.
- Keep login, refresh, retry, and logout behavior consistent across the app.
