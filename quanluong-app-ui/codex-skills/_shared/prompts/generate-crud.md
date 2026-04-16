# Generate CRUD Feature

Prompt này dành cho việc scaffold nhanh một feature CRUD nhưng vẫn giữ kiến trúc sạch.
Use this prompt when you want Codex to scaffold create, read, update, and delete flows for a feature.

## Input Checklist

Bạn nên mô tả entity, form, bảng và integration style càng cụ thể càng tốt.
- entity name
- route or feature folder
- fields for table and form
- create and update validation rules
- API integration style

## Output Expectations

Kỳ vọng đầu ra là tách UI khỏi orchestration và tái dùng được.
- keep API orchestration outside presentational components
- separate table, form, and mutation logic
- follow the app's existing state and data fetching conventions
