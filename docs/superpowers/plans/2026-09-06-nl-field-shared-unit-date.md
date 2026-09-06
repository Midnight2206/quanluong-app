# NL_FIELD Shared Unit/Date Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Move `don_vi`, `don_vi_cap_tren`, `ngay_thang_nam` to `NL_FIELD_*` (no labels); drop legacy `FIELD_*` for those three.

**Spec:** `docs/superpowers/specs/2026-09-06-nl-field-shared-unit-date-design.md`

## Global Constraints

- Keys: donVi, donViCapTren, ngayThangNam
- Named ranges: NL_FIELD_don_vi, NL_FIELD_don_vi_cap_tren, NL_FIELD_ngay_thang_nam
- No legacy FIELD_ for these three
- Value from existing resolver (no new formatters required)

---

### Task 1: BE + FE NL catalog and resolve

**Files:** `chung-tu-nl-field.js` (+test), `chung-tu-pdf-field-catalog.js` (+test), `chung-tu-pdf-column-alias.util.js` (+test), FE `chungTuNlField.js` (+test), any tests still expecting FIELD_don_vi / FIELD_ngay_thang_nam

- [ ] Add NL catalog scalars + key map
- [ ] Remove FIELD catalog rows for the three
- [ ] resolveNlFieldKey / resolveScalarFieldKey: NL works; FIELD_don_vi etc. do **not** resolve to donVi (assert empty or non-match)
- [ ] FE mirror
- [ ] Commit: `feat(chung-tu): move shared unit/date fields to NL_FIELD`

---

## Ops

Re-upload Excel templates with new Named Ranges.
