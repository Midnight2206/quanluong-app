# Cursor skills

Cursor loads each `SKILL.md` under this directory (local IDE and cloud agents, once committed). Third-party skills keep their own `LICENSE` or `LICENSE.txt`. See `NOTICE` for attribution.

Do not add the Anthropic `docx`, `pdf`, `pptx`, or `xlsx` skills. Those are source-available, not Apache-2.0. Excel and PDF work for this app is `quanluong-document-exports`.

## Added in this change

| Skill | Source | Licence | When to use |
|---|---|---|---|
| `webapp-testing` | https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/webapp-testing | Apache-2.0 | Playwright scripts against a local web app. Run `scripts/with_server.py --help` before reading the helper. |
| `quanluong-ui-testing` | Original, this repo | Repo code (same as the app) | How to start Quân lương, log in on a local DB, and smoke-test `/so-sach-bep-an` and `/lttp-nhap-xuat`. Use with `webapp-testing`. |
| `frontend-design` | https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/frontend-design | Apache-2.0 | New or reshaped UI that needs a deliberate visual direction. |
| `mcp-builder` | https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/mcp-builder | Apache-2.0 | Building an MCP server in Python or TypeScript. |
| `skill-creator` | https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/skill-creator | Apache-2.0 | Writing or evaluating a skill. |
| `explore-data` | https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/data/skills/explore-data | Apache-2.0 | Profile a table or file before analysis. |
| `validate-data` | https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/data/skills/validate-data | Apache-2.0 | Check an analysis before sharing it. |
| `sql-queries` | https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/data/skills/sql-queries | Apache-2.0 | Dialect-specific analytical SQL. For this app's MariaDB, prefer `quanluong-data-context`. |
| `write-query` | https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/data/skills/write-query | Apache-2.0 | Turn a question into an optimized SQL query. |
| `data-visualization` | https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/data/skills/data-visualization | Apache-2.0 | Chart choice and Python figures. |
| `build-dashboard` | https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/data/skills/build-dashboard | Apache-2.0 | One self-contained HTML dashboard. |
| `statistical-analysis` | https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/data/skills/statistical-analysis | Apache-2.0 | Descriptive stats, trends, outliers, hypothesis tests. |
| `data-context-extractor` | https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/data/skills/data-context-extractor | Apache-2.0 | Bootstrap or extend a company data-context skill. |
| `quanluong-data-context` | Original, from the extractor's approach plus this schema | Repo code | Units, mức ăn, LTTP groups, phiếu xuất, ledger frame, and JS `computeLedger` tồn. MariaDB 11.4. |
| `pr-review` | Adapted from https://github.com/anthropics/claude-plugins-official/tree/58267944f92187b7d6a1c822165c96c81c864806/plugins/code-review and `.../plugins/pr-review-toolkit` | Apache-2.0 | Review a PR or diff. Upstream prompts are in `pr-review/references/upstream/`. |
| `quanluong-document-exports` | Original, from `services/document-service` | Repo code | Merged-cell xlsx templates and phiếu xuất kho PDFs with e-signature images. |

Playwright MCP for Cursor is `.cursor/mcp.json` (`npx -y @playwright/mcp@latest`). No database MCP is configured.

Other folders already in `.cursor/skills/` (ECC and repo patterns such as `mysql-patterns` and `ui-styling`) are unchanged by this list and keep their own headers.
