# PNK Hide Data-Unit Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On PNK monthly export, hide “Đơn vị đưa dữ liệu”, stop requiring/sending `unitIds`, keep kho `unitId`.

**Architecture:** Gate existing monthly multi-select + validations with `!isPnkMonthly`. Omit `unitIds` from PNK payload. Adjust wizard summary/copy. Guard with source-string tests next to existing PNK aggregation tests.

**Tech Stack:** React (`packages/shared`), `node:test` source asserts

**Spec:** `docs/superpowers/specs/2026-09-05-pnk-hide-data-unit-picker-design.md`

## Global Constraints

- Giữ picker đơn vị kho LTTP (`unitId`)
- Ẩn hoàn toàn “Đơn vị đưa dữ liệu” trên PNK
- Payload PNK: gửi `unitId` + `periodMonth`; không gửi `unitIds`
- FE không validate / không `canRun`-gate theo `selectedDataUnitIds` cho PNK
- BE không đổi trong scope này
- PXK / BKMH monthly vẫn giữ multi-select đơn vị

---

## File Map

| File | Role |
|------|------|
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx` | Hide picker, payload, validate, copy |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuBkmhMonthlySummary.test.js` | Extend PNK source asserts (or add sibling test file if preferred — keep in this file next to existing PNK test) |

---

### Task 1: PNK FE — hide data units, omit unitIds

**Files:**
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx`
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuBkmhMonthlySummary.test.js`

**Interfaces:**
- Consumes: existing `isPnkMonthly`
- Produces: PNK monthly payload without `unitIds` key; UI without data-unit multi-select

- [ ] **Step 1: Write failing source tests**

Append to `ChungTuBkmhMonthlySummary.test.js` (same file as existing PNK aggregation test):

```js
test("PNK monthly export hides data-unit picker and omits unitIds from payload", () => {
  assert.match(exportWorkspaceSource, /isPnkMonthly/);
  // multi-select only when monthly AND not PNK
  assert.match(
    exportWorkspaceSource,
    /isMonthly && !isPnkMonthly && unitsForDropdown\.length > 0/,
  );
  // payload: unitIds only when not PNK
  assert.match(
    exportWorkspaceSource,
    /unitIds:\s*selectedDataUnitIds/,
  );
  assert.match(
    exportWorkspaceSource,
    /!\s*isPnkMonthly[\s\S]{0,200}unitIds:\s*selectedDataUnitIds|unitIds:\s*selectedDataUnitIds[\s\S]{0,80}(?=[\s\S]*isPnkMonthly)/,
  );
  // stronger: buildPayloadBase branches so PNK monthly object has no unitIds property
  assert.match(
    exportWorkspaceSource,
    /if \(isMonthly\) \{[\s\S]*?return \{[\s\S]*?\.\.\.base,[\s\S]*?periodMonth,[\s\S]*?(?:\.\.\.\(!isPnkMonthly \? \{ unitIds: selectedDataUnitIds \} : \{\}\),|unitIds: isPnkMonthly \? undefined : selectedDataUnitIds)/,
  );
  assert.match(
    exportWorkspaceSource,
    /isMonthly && !isPnkMonthly && selectedDataUnitIds\.length === 0/,
  );
  assert.match(
    exportWorkspaceSource,
    /isMonthly\s*\?\s*\(!isPnkMonthly \? selectedDataUnitIds\.length > 0 : Boolean\(periodMonth\)\)|isMonthly\s*\?\s*\(isPnkMonthly \|\| selectedDataUnitIds\.length > 0\)/,
  );
});
```

If the regex above is too brittle, prefer these concrete asserts after deciding the exact implementation shape in Step 3 — **rewrite the test in Step 1 to match the chosen shape below**, then implement.

**Preferred implementation shape (use this — rewrite Step 1 asserts to match):**

```js
// buildPayloadBase monthly branch:
if (isMonthly) {
  return {
    ...base,
    periodMonth,
    aggregationMode: effectiveAggregationMode,
    ...(isPnkMonthly ? {} : { unitIds: selectedDataUnitIds }),
  };
}

// canRun:
const canRun =
  Boolean(selectedTemplate) &&
  (isMonthly
    ? isPnkMonthly
      ? Boolean(periodMonth)
      : selectedDataUnitIds.length > 0
    : isBySlip
      ? Boolean(issueSlipId)
      : Boolean(periodDate));

// validateWizardStep0 + handleCreate:
if (isMonthly && !isPnkMonthly && selectedDataUnitIds.length === 0) {
  setActionError("Chọn ít nhất một đơn vị để đưa dữ liệu vào chứng từ."); // or existing message variants
  ...
}

// UI:
{isMonthly && !isPnkMonthly && unitsForDropdown.length > 0 ? ( ... Đơn vị đưa dữ liệu ... ) : null}

// wizard summary monthly line:
{isPnkMonthly
  ? `${aggregationLabel} · nguồn BKMH`
  : `${aggregationLabel} · ${selectedDataUnitIds.length} đơn vị`}

// wizard card description when isPnkMonthly:
"Chọn kho và tháng — dữ liệu lấy từ BKMH đã xuất (và hóa đơn khi có)."
// else keep existing LTTP copy
```

Rewrite Step 1 test to:

```js
test("PNK monthly export hides data-unit picker and omits unitIds from payload", () => {
  assert.match(
    exportWorkspaceSource,
    /isMonthly && !isPnkMonthly && unitsForDropdown\.length > 0/,
  );
  assert.match(
    exportWorkspaceSource,
    /\.\.\.\(isPnkMonthly \? \{\} : \{ unitIds: selectedDataUnitIds \}\)/,
  );
  assert.match(
    exportWorkspaceSource,
    /isMonthly && !isPnkMonthly && selectedDataUnitIds\.length === 0/,
  );
  assert.match(
    exportWorkspaceSource,
    /isPnkMonthly\s*\?\s*Boolean\(periodMonth\)\s*:\s*selectedDataUnitIds\.length > 0/,
  );
  assert.match(exportWorkspaceSource, /nguồn BKMH/);
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd packages/shared && node --test src/pages/chungTuQuyetToan/ChungTuBkmhMonthlySummary.test.js
```

Expected: new test FAIL (patterns not present yet). Existing PNK aggregation test still PASS.

- [ ] **Step 3: Implement in `ChungTuExportWorkspace.jsx`**

Apply the preferred shape from Step 1:

1. `buildPayloadBase` — spread `unitIds` only when `!isPnkMonthly`
2. `canRun` — PNK monthly uses `Boolean(periodMonth)` instead of `selectedDataUnitIds.length > 0`
3. `validateWizardStep0` and `handleCreate` — gate data-unit empty check with `!isPnkMonthly`
4. Multi-select render condition: `isMonthly && !isPnkMonthly && unitsForDropdown.length > 0`
5. Wizard summary + card `description` for PNK as above
6. Keep warehouse picker unchanged

Remove `selectedDataUnitIds` from `buildPayloadBase` dependency array only if no longer referenced there for PNK path — still needed for non-PNK monthly.

- [ ] **Step 4: Run tests — expect PASS**

Same command as Step 2. Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx \
  packages/shared/src/pages/chungTuQuyetToan/ChungTuBkmhMonthlySummary.test.js
git commit -m "$(cat <<'EOF'
fix(chung-tu): hide PNK data-unit picker; omit unitIds

EOF
)"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| Hide data-unit UI on PNK | T1 |
| Keep kho picker | T1 (unchanged) |
| Omit `unitIds`, keep `unitId` | T1 |
| No validate/canRun on data units for PNK | T1 |
| BE unchanged | — |
| BKMH/PXK unchanged | T1 gates with `!isPnkMonthly` |

No placeholders left.
