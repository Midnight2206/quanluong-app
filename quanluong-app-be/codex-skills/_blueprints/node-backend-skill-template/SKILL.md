---
name: node-backend-skill-template
description: Build or refactor a backend concern with clear trigger terms, layered architecture rules, reusable templates, and references for the specific domain.
---

# Purpose

Phan nay mo ta ro khi nao skill nen duoc trigger.
Use this skill when the task involves:

- primary trigger phrase 1
- primary trigger phrase 2
- related backend architectural concern

# Rules

Giữ `SKILL.md` ngắn, còn chi tiết kỹ thuật nên đẩy sang resource chuyên biệt.
- Reuse the backend's existing architecture before introducing new patterns.
- Prefer native ESM `import` / `export` syntax in generated backend code and templates.
- Keep `SKILL.md` short and procedural.
- Put detailed domain notes in `references/`.
- Put reusable implementation snippets in `templates/`.
- Put small usage or flow samples in `examples/`.

# Workflow

Đây là workflow tối thiểu cho một backend skill dễ mở rộng và ít tốn context.
1. Read the most relevant file in `references/` for the requested task.
2. Reuse files from `templates/` when the task needs code generation.
3. Adapt naming, folder structure, and module boundaries to the current backend.
4. Keep business rules aligned with existing project conventions.

# Adaptation Notes

Khi nhân skill mới, bạn chỉ nên đổi đúng phần liên quan tới domain đó.
- Expand the frontmatter `description` with the real trigger language users will actually type.
- Avoid duplicating template code inside this file.
- Add `agents/openai.yaml` so the skill is easier to browse and reuse.
