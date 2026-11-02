---
name: pr-review
description: Review a pull request or local diff for real bugs, comment rot, test gaps, silent failures, type design, and simplification. Use before opening or merging a PR, or when the user asks for a code review. Adapted from Anthropic's code-review and pr-review-toolkit plugins for Cursor.
---

# PR review

Cursor skill adapted from Anthropic's Claude Code plugins `code-review` and `pr-review-toolkit` (Apache-2.0). The upstream prompts are commands and subagents, not skills. They are kept verbatim under `references/upstream/`. Read the matching file before that pass. Do not post a GitHub comment unless the user explicitly asks.

Project guidance here is `.cursor/rules/*.mdc` plus any `CLAUDE.md` or `AGENTS.md`. Treat those files the way the upstream prompts treat `CLAUDE.md`.

## When to run which pass

| Pass | Read | Run when |
|---|---|---|
| Eligibility and confidence-scored bugs | `references/upstream/code-review.md` | A GitHub PR is in scope |
| Aspects to combine | `references/upstream/review-pr.md` | The user wants a full review |
| Guidelines and bugs | `references/upstream/code-reviewer.md` | Always, on the diff |
| Comments | `references/upstream/comment-analyzer.md` | Comments or docs changed |
| Tests | `references/upstream/pr-test-analyzer.md` | Tests changed, or new behavior has no test |
| Silent failures | `references/upstream/silent-failure-hunter.md` | Error handling, catch, or fallbacks changed |
| Types | `references/upstream/type-design-analyzer.md` | Types or schemas were added or changed |
| Simplify | `references/upstream/code-simplifier.md` | After the review, only if the user wants a cleanup |

Default is every pass that applies. The user can name a subset (tests, errors, types, comments, code, simplify).

## How to review in Cursor

1. Diff the branch against the base (`git diff <base>...HEAD`), or `git diff` for uncommitted work. Note the file list before reading bodies.
2. Skip the review when the PR is closed, draft, or a generated lockfile-only change, or when you already reviewed this exact head.
3. Review the diff for bugs that will happen in practice. Ignore pre-existing issues, lint the CI will catch, and nits a senior would not mention.
4. Score each issue 0–100 using the rubric in `references/upstream/code-review.md` (0 false positive, 25 unsure, 50 real but minor, 75 likely and important, 100 certain). Drop anything under 80.
5. For the other passes, follow that reference's checklist and keep only issues you can point at in the diff.
6. Reply in the conversation. Lead with the highest-confidence findings. Use this shape:

```markdown
# PR review

## Critical
- [pass] what is wrong (`path:line`)

## Important
- [pass] what is wrong (`path:line`)

## Suggestions
- [pass] optional change (`path:line`)

## Strengths
- what is solid
```

If nothing scores 80 or above, say that no high-confidence issue was found and list residual risk in one sentence. Cite the file. Do not invent a SHA link when you are looking at a local diff; use `path:line`.
