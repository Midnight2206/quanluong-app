# LTTP Responsive Compact Sticky Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the “Nhập xuất LTTP” heading and make the unit/action toolbar morph into a compact level-0 sticky bar above the level-1 tabs across phone, tablet, and desktop.

**Architecture:** Keep the existing unified sticky registry. `LttpNhapXuatPage` owns one sentinel and an `IntersectionObserver` scoped to the nearest `[data-page-scroll-owner]`; the existing toolbar changes responsive classes and content visibility when the sentinel leaves the scroll viewport. `TabPanel` remains sticky level 1 and receives its offset from the registry.

**Tech Stack:** React 19, Next.js 15, Tailwind CSS, unified sticky marker registry, Chrome DevTools.

## Global Constraints

- Do not add another vertical scroll owner.
- Keep `data-sticky-level="0"` on the responsive toolbar and `stickyTabListLevel={1}` on tabs.
- Keep all controls keyboard accessible and retain a programmatic label in compact mode.
- Add no dependency or new shared abstraction.

---

### Task 1: Responsive compact sticky toolbar

**Files:**
- Modify: `packages/shared/src/pages/lttpNhapXuat/LttpNhapXuatPage.jsx:1-323`
- Test: `packages/shared/src/pages/lttpNhapXuat/LttpNhapXuatPage.test.js`

**Interfaces:**
- Consumes: `[data-page-scroll-owner]`, `[data-sticky-level]`, `TabPanel.stickyTabListLevel`
- Produces: local boolean `isToolbarCompact`; responsive level-0 unit/action toolbar

- [ ] **Step 1: Write the failing source contract test**

Assert that the old `<h1>` copy is absent, the page contains a sentinel and `IntersectionObserver`, the toolbar emits sticky level 0, and tabs remain level 1.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test packages/shared/src/pages/lttpNhapXuat/LttpNhapXuatPage.test.js
```

Expected: FAIL because the heading still exists and compact-toolbar behavior is absent.

- [ ] **Step 3: Implement the minimal toolbar behavior**

In `LttpNhapXuatPage`:

- Add `toolbarSentinelRef` and `isToolbarCompact`.
- Observe the sentinel with `root: sentinel.closest("[data-page-scroll-owner]")`.
- Remove the heading and its old standalone sticky wrapper.
- Place the sentinel before the toolbar.
- Mark the toolbar `data-sticky-level="0"` and `unified-sticky-surface`.
- Full state: mobile-first stacked select/actions; tablet two-column actions; desktop select left/actions right.
- Compact state: hide action buttons and visual label, reduce padding/gap, constrain select width on desktop.
- Preserve the select’s accessible name through its existing `<label>`/`htmlFor`.
- Keep `TabPanel` at `stickyTabListLevel={1}`.

- [ ] **Step 4: Run the focused test and lint**

Run:

```bash
node --test packages/shared/src/pages/lttpNhapXuat/LttpNhapXuatPage.test.js
```

Expected: PASS.

Check IDE lint for the modified page and test; expected: no new diagnostics.

---

### Task 2: Production and browser verification

**Files:**
- Verify: `packages/shared/src/pages/lttpNhapXuat/LttpNhapXuatPage.jsx`

**Interfaces:**
- Consumes: production web build and authenticated LTTP route
- Produces: verified responsive/sticky behavior

- [ ] **Step 1: Run automated verification**

```bash
npm run audit:unified-scroll
node --test packages/shared/src/pages/lttpNhapXuat/LttpNhapXuatPage.test.js packages/shared/src/hocs/stickyRegistry.test.js
cd apps/web && npm run build
```

Expected: audit passes, all tests pass, production build exits 0.

- [ ] **Step 2: Inspect with Chrome DevTools**

At 390×844, 768×1024, and 1440×900 verify:

- one `[data-page-scroll-owner]`;
- no document horizontal overflow;
- full toolbar reflows without clipped controls;
- after scrolling, toolbar actions hide and select remains sticky;
- tab bar top equals the compact toolbar’s measured bottom;
- scrolling back restores the full toolbar without layout overlap.

- [ ] **Step 3: Re-run focused verification after visual adjustments**

Repeat audit, focused tests, lint, and web production build. Expected: all green.
