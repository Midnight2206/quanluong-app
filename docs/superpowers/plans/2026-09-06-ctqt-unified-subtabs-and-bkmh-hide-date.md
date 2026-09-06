# CTQT Unified Sub-tabs + BKMH Hide Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify CTQT category sub-tabs to four fixed tabs with `hasSummary`-gated disabled Tổng hợp; hide BKMH “Ngày chứng từ” on export.

**Architecture:** Extend `TabPanel` with `disabled` tabs; drive tab list from `chungTuCategoryConfig.hasSummary` in `ChungTuCategoryWorkspace`; guard period-date UI in `ChungTuExportWorkspace`.

**Tech Stack:** React (`packages/shared`), `node:test` source asserts

**Spec:** `docs/superpowers/specs/2026-09-06-ctqt-unified-subtabs-and-bkmh-hide-date-design.md`

## Global Constraints

- Tab order: export → summary → history → signature-settings
- Always 4 tabs for available categories
- Summary `disabled` when `!hasSummary` (only BKMH has summary for now)
- Disabled persist restore → fall back to enabled default
- BKMH: hide periodDate (Ngày chứng từ); keep month
- No BE / API changes
- No new dependencies

---

## File Map

| File | Role |
|------|------|
| `packages/shared/src/components/common/TabPanel.jsx` | `disabled` on tab buttons + persist fallback |
| `packages/shared/src/pages/chungTuQuyetToan/chungTuCategoryConfig.js` | `hasSummary` |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuCategoryWorkspace.jsx` | Always 4 tabs |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx` | Hide BKMH day field |
| Matching `*.test.js` | Source asserts |

---

### Task 1: TabPanel `disabled` + config `hasSummary` + workspace 4 tabs

**Files:**
- Modify: `TabPanel.jsx`
- Modify: `chungTuCategoryConfig.js`
- Modify: `ChungTuCategoryWorkspace.jsx`
- Create/modify tests under `packages/shared/src/pages/chungTuQuyetToan/` and/or TabPanel test if exists

**Interfaces:**
- Produces: tab `{ disabled?: boolean }`; config `hasSummary: boolean`

- [ ] **Step 1: Failing source tests**

```js
// ChungTuCategoryWorkspace source
assert.match(source, /hasSummary/);
assert.match(source, /id: "export"/);
assert.match(source, /id: "summary"/);
assert.match(source, /id: "history"/);
assert.match(source, /id: "signature-settings"/);
assert.doesNotMatch(source, /\.\.\.\(isBkmh/); // no conditional inject of summary-only tab

// config
assert.equal(getChungTuCategoryConfig("bang-ke-mua-hang").hasSummary, true);
assert.equal(getChungTuCategoryConfig("phieu-nhap-kho").hasSummary, false);

// TabPanel
assert.match(tabPanelSource, /disabled/);
```

- [ ] **Step 2: Implement**

1. `TabPanel`: if `tab.disabled`, render button disabled; ignore click; when resolving `safeActive`, if active tab disabled → first non-disabled tab (or `defaultTabId` if enabled).
2. Config list: `hasSummary: tab.id === "bang-ke-mua-hang"` (or map).
3. Workspace: always four tabs; `disabled: !config?.hasSummary` on summary; panel for disabled can be `null` or short placeholder (unused when disabled).

- [ ] **Step 3: Tests PASS**

```bash
cd packages/shared && node --test src/pages/chungTuQuyetToan/*.test.js
# plus any TabPanel test path if added
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): unify category sub-tabs with disabled summary

EOF
)"
```

---

### Task 2: Hide BKMH Ngày chứng từ

**Files:**
- Modify: `ChungTuExportWorkspace.jsx`
- Modify: existing export/page test (e.g. `ChungTuBkmhMonthlySummary.test.js` or add assert in page test)

- [ ] **Step 1: Failing test** — BKMH export source: period-date block gated with `!isBkmhMonthly` (or equivalent); still has “Tháng chứng từ”.

- [ ] **Step 2: Implement** — wrap “Ngày chứng từ” so it does not render for BKMH monthly.

- [ ] **Step 3: PASS + Commit**

```bash
git commit -m "$(cat <<'EOF'
fix(chung-tu): hide period date on BKMH export form

EOF
)"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| 4 fixed tabs + order | T1 |
| hasSummary / disabled | T1 |
| TabPanel disabled + persist fallback | T1 |
| Hide BKMH day | T2 |

## Ops

None (FE only).
