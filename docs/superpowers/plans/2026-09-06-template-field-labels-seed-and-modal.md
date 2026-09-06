# Template Field Labels Seed + Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed `fieldLabelsJson` from previous same-name template on upload; move label editor into a modal.

**Architecture:** BE findFirst prior labels on create; FE remove inline editor, open Dialog for labels.

**Tech Stack:** Prisma/Node, React shared, node:test

**Spec:** `docs/superpowers/specs/2026-09-06-template-field-labels-seed-and-modal-design.md`

## Global Constraints

- Prior = same categoryKey + name, latest updatedAt
- Modal only for labels; schema list can stay
- No new dependencies if Dialog exists; else minimal modal overlay
- Save API unchanged

---

## File Map

| File | Role |
|------|------|
| `chung-tu-pdf-template.service.js` (+ test) | Seed on create |
| `SuperadminChungTuPdfCategoryTemplates.jsx` (+ test) | Modal UI |
| Dialog component if needed | Reuse existing |

---

### Task 1: BE seed fieldLabels on create

- [ ] **Step 1: Failing test** — create with existing same-name row that has labels → new template `fieldLabels` equals prior; different name → `{}`.

- [ ] **Step 2: Implement** findFirst + set `fieldLabelsJson` on create.

- [ ] **Step 3: PASS + Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): seed PDF template field labels from prior version

EOF
)"
```

---

### Task 2: FE labels modal

- [ ] **Step 1: Failing source test** — no inline “Nhãn field” section always visible; has modal/dialog open for labels; still has Save mutation.

- [ ] **Step 2: Implement** — button “Nhãn field”; dialog with existing draft/save logic; remove inline block.

- [ ] **Step 3: PASS + Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): move template field labels editor into modal

EOF
)"
```

---

## Ops

None.
