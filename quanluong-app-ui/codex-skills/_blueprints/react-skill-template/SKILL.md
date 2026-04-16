---
name: react-skill-template
description: Build or update a React app concern with clear trigger terms, workflow rules, shared conventions, and references for the specific domain.
---

# Purpose

Phần này mô tả rõ khi nào skill nên được trigger.
Use this skill when the task involves:

- primary trigger phrase 1
- primary trigger phrase 2
- related architectural concern

# Rules

Giữ `SKILL.md` ngắn, còn chi tiết kỹ thuật nên đẩy sang resource chuyên biệt.
- Reuse the app's existing architecture before introducing new patterns.
- Prefer native ESM `import` / `export` syntax in generated React code.
- Keep `SKILL.md` short and procedural.
- Put detailed domain notes in `references/`.
- Put reusable implementation snippets in `templates/` or `assets/`.
- Put small usage samples in `examples/`.

# Workflow

Đây là workflow tối thiểu cho một skill dễ mở rộng và ít tốn context.
1. Read the most relevant file in `references/` for the requested task.
2. Reuse files from `templates/` or `assets/` when the task needs code generation.
3. Adapt naming, paths, and environment variables to the current app.
4. Keep business rules aligned with existing project conventions.

# Adaptation Notes

Khi nhân skill mới, bạn chỉ nên đổi đúng phần liên quan tới domain đó.
- Expand the frontmatter `description` with the real trigger language users will actually type.
- Avoid duplicating template code inside this file.
- Add `agents/openai.yaml` so the skill is easier to browse and reuse.
