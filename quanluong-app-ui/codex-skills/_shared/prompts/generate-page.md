# Generate Page

Prompt này dùng để tạo page mới mà không phá vỡ structure React hiện có.
Use this prompt when you want Codex to create a new page within the app's existing React architecture.

## Input Checklist

Mô tả rõ data dependency, state hiển thị và action của page.
- route path
- page purpose
- data dependencies
- loading and empty states
- actions available on the page

## Output Expectations

Page sinh ra nên mỏng, dễ đọc, và đẩy logic dùng lại xuống layer thấp hơn.
- preserve the current layout and feature boundaries
- keep page components readable and thin
- move reusable business logic into hooks, services, or feature modules
