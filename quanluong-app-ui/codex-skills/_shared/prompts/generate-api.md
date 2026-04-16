# Generate API Module

Prompt này dùng khi muốn sinh service hoặc API module từ endpoint contract.
Use this prompt when you want Codex to create a service or API module from an endpoint contract.

## Input Checklist

Đầu vào càng rõ thì file API sinh ra càng ít phải sửa tay.
- endpoint path
- method
- request params or body
- response shape
- destination file path

## Output Expectations

Đầu ra nên bám đúng shared client và boundary của feature.
- use the shared HTTP client instead of raw transport calls in components
- keep functions small and named by intent
- export a thin service API that the feature layer can consume
