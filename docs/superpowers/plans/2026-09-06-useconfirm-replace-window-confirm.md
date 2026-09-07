# useConfirm Replace window.confirm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every `window.confirm` in `packages/shared` with `useConfirm` (danger for deletes, default for discard/continue).

**Architecture:** Existing `ConfirmProvider` / `useConfirm`; async `await confirm({...})`.

**Tech Stack:** React shared package, `node:test` source asserts

**Spec:** `docs/superpowers/specs/2026-09-06-useconfirm-replace-window-confirm-design.md`

## Global Constraints

- Zero `window.confirm` left in packages/shared
- Delete → `variant: "danger"`
- Unsaved/continue → `variant: "default"`
- No new dependencies / no new confirm system

---

## File Map

| File | Change |
|------|--------|
| `ChungTuHistoryWorkspace.jsx` | useConfirm ×2 deletes |
| `ProfilePage.jsx` | useConfirm avatar delete |
| `KitchenMenuTab.jsx` | useConfirm ×3 unsaved |
| `KitchenMenuAiSuggestDialog.jsx` | useConfirm if present |
| Matching `*.test.js` | assert no window.confirm |

---

### Task 1: Migrate all window.confirm call sites

**Files:** listed above (+ tests)

- [ ] **Step 1: Failing tests** — assert `doesNotMatch(/window\.confirm/)` on each file source; assert `useConfirm` present where needed.

- [ ] **Step 2: Implement**

For each site:

```js
const { confirm } = useConfirm();
// ...
const ok = await confirm({
  title: "...",
  message: "...",
  confirmLabel: "Xóa" | "Tiếp tục" | ...,
  variant: "danger" | "default",
});
if (!ok) return;
```

Make handlers `async` if not already. Import `useConfirm` from `@/contexts/ConfirmProvider`.

- [ ] **Step 3: Verify**

```bash
rg 'window\.confirm' packages/shared   # expect no matches
cd packages/shared && node --test <relevant tests>
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor(ui): replace window.confirm with useConfirm

EOF
)"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| All window.confirm gone | T1 |
| danger vs default | T1 |

## Ops

None.
