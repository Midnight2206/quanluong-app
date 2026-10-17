# ECC (Everything Claude Code) — curated Cursor install for quanluong-app

Source: https://github.com/affaan-m/ECC @ 76aaa77 (v2.2.3, MIT License, (c) 2026 Affaan Mustafa)
Installed: 2026-10-17, project-scoped, by selective copy from the official
`install.sh --target cursor --no-hooks` output (only stack-relevant pieces kept).

## What is installed
- `.cursor/rules/ecc-*.mdc` — 8 always-on common rules (coding style, workflow, git,
  patterns, performance, security, testing, agents) + glob-scoped TypeScript/JS,
  Python, React rules + an on-demand code-review rule.
- `.cursor/skills/<name>/SKILL.md` — 26 skills (TDD, verification loop, security review,
  Next.js, React, Node backend, API design, Prisma, MySQL/MariaDB, migrations, Python,
  Docker, deployment, Redis, e2e, search-first, ...).
- `.cursor/agents/ecc-*.md` — 17 subagent definitions (planner, architect, code-reviewer,
  security-reviewer, tdd-guide, build-error-resolver, ...).
- `.cursor/commands/ecc-*.md` — 11 slash commands (/ecc-plan, /ecc-code-review, ...).

## NOT installed (on purpose)
- Hooks (`.cursor/hooks.json`, `.cursor/hooks/*.js`, `scripts/hooks/*`): these run Node
  scripts automatically on Cursor events (shell, file edit, prompt submit, session start/stop)
  and write memory under ~/.cursor/ecc. Opt-in only — see the upstream README.
- MCP config (`.cursor/mcp.json`, chrome-devtools via npx).
- Continuous-learning / instincts / memory (hook-based), AgentShield (`npx ecc-agentshield`).
- Rules/skills for other languages (Go, Kotlin, PHP, Swift, Java, Rust, ...), business,
  social, trading, healthcare, ML skills.

## Uninstall
Delete the files listed in `.cursor/ecc/FILES.txt` and this folder.
