# Request Flow

Luồng request này áp dụng cho các service function dùng chung HTTP client.
1. Call the shared client from a service module.
2. The client sends the request with shared defaults such as `baseURL` and `withCredentials`.
3. On success, return `response.data`.
4. On failure, let the interceptor decide whether the error is retryable.
5. If the failure is not retryable, reject it to the caller.

## Retryability Rules

Không phải lỗi nào cũng nên retry, đặc biệt là network failure hoặc auth route.
- Retry only when the response is `401` and the request is eligible for refresh.
- Do not retry network failures blindly.
- Do not retry login, register, logout, or refresh endpoints through the refresh flow.
