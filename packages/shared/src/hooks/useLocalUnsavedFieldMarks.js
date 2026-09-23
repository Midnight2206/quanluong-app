"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  clearLocalUnsavedFieldRegistry,
  listLocalUnsavedFields,
  markLocalUnsavedField,
  unmarkLocalUnsavedField,
} from "@/lib/clientPersist/localUnsavedFieldRegistry.js";

const TIP =
  "Dữ liệu chưa được lưu vào máy chủ. Đây chỉ là dữ liệu tạm trên máy.";

const SKIP_TYPES = new Set([
  "password",
  "file",
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
]);

const MARK_CLASS = "ql-local-unsaved-mark";
const SECTION_MARK_CLASS = "ql-local-unsaved-section-mark";
const FIELD_CLASS = "ql-local-unsaved";
const SECTION_SEL = "[data-local-unsaved-section]";
const SECTION_KEY_PREFIX = "section:";

/** Current route for mark/unmark from DOM handlers (updated by hook). */
let routeKeyForRegistry = "";

function isMarkableControl(el) {
  if (!(el instanceof HTMLElement)) {
    return false;
  }
  const tag = el.tagName;
  if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
    return false;
  }
  if (!el.closest?.("[data-local-commit-form='true']")) {
    return false;
  }
  if (el.closest?.("[data-no-persist-root='true']")) {
    return false;
  }
  if (el.closest?.("[data-ui-preference='true']") || el.closest?.("[data-no-unsaved-mark='true']")) {
    return false;
  }
  if (el.dataset?.noPersist === "true" || el.dataset?.noUnsavedMark === "true") {
    return false;
  }
  if (el.dataset?.localCommit === "false") {
    return false;
  }
  if (tag === "INPUT") {
    const type = String(el.type || "text").toLowerCase();
    if (SKIP_TYPES.has(type) || type === "search") {
      return false;
    }
  }
  if (el.getAttribute?.("role") === "searchbox") {
    return false;
  }
  if (el.disabled) {
    return false;
  }
  return true;
}

function snapshotValue(el) {
  const type = String(el.type || "").toLowerCase();
  if (type === "checkbox" || type === "radio") {
    return el.checked ? "1" : "0";
  }
  return String(el.value ?? "");
}

function fieldHasValue(el) {
  const type = String(el.type || "").toLowerCase();
  if (type === "checkbox" || type === "radio") {
    return Boolean(el.checked);
  }
  return String(el.value ?? "").trim() !== "";
}

function fieldKey(el) {
  return el.dataset.persistKey || el.name || el.id || "";
}

function nearestSection(el) {
  return el.closest?.(SECTION_SEL) || null;
}

function sectionRegistryKey(section) {
  if (!(section instanceof HTMLElement)) {
    return "";
  }
  const raw = section.getAttribute("data-local-unsaved-section");
  if (raw && raw !== "true") {
    return `${SECTION_KEY_PREFIX}${raw}`;
  }
  if (section.id) {
    return `${SECTION_KEY_PREFIX}${section.id}`;
  }
  return "";
}

function isSectionRegistryKey(key) {
  return String(key).startsWith(SECTION_KEY_PREFIX);
}

function ensureRelativeHost(host) {
  if (!host || host.dataset.qlUnsavedHost === "1") {
    return host;
  }
  const pos = typeof window !== "undefined" ? window.getComputedStyle(host).position : "static";
  if (pos === "static") {
    host.style.position = "relative";
    host.dataset.qlUnsavedPos = "1";
  }
  host.dataset.qlUnsavedHost = "1";
  return host;
}

function ensureFieldHost(el) {
  let host =
    el.closest?.("[data-unsaved-mark-host]") ||
    el.closest?.("label") ||
    el.parentElement;
  if (!host || host === document.body) {
    host = el.parentElement;
  }
  return ensureRelativeHost(host);
}

function attrSelector(attr, value) {
  const safe = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[${attr}="${safe}"]`;
}

function findControlInRoot(root, key) {
  if (!root || !key || isSectionRegistryKey(key)) {
    return null;
  }
  const tries = [
    () => root.querySelector(attrSelector("name", key)),
    () => {
      if (typeof CSS !== "undefined" && CSS.escape) {
        return root.querySelector(`#${CSS.escape(key)}`);
      }
      return root.querySelector(`#${key}`);
    },
    () => root.querySelector(attrSelector("data-persist-key", key)),
  ];
  for (const pick of tries) {
    const el = pick();
    if (el && isMarkableControl(el)) {
      return el;
    }
  }
  return null;
}

function findSectionInRoot(root, registryKey) {
  if (!root || !isSectionRegistryKey(registryKey)) {
    return null;
  }
  const id = registryKey.slice(SECTION_KEY_PREFIX.length);
  if (!id) {
    return null;
  }
  return (
    root.querySelector(attrSelector("data-local-unsaved-section", id)) ||
    (typeof CSS !== "undefined" && CSS.escape
      ? root.querySelector(`#${CSS.escape(id)}`)
      : root.querySelector(`#${id}`))
  );
}

function removeFieldIcon(el) {
  const key = fieldKey(el);
  const host = el.closest?.("[data-ql-unsaved-host='1']") || el.parentElement;
  if (!host) {
    return;
  }
  const mark = [...host.querySelectorAll(`:scope > .${MARK_CLASS}:not(.${SECTION_MARK_CLASS})`)].find(
    (m) => m.dataset.forField === key,
  );
  mark?.remove();
  if (!host.querySelector(`.${FIELD_CLASS}`) && !host.querySelector(`.${SECTION_MARK_CLASS}`)) {
    if (host.dataset.qlUnsavedPos === "1") {
      host.style.position = "";
      delete host.dataset.qlUnsavedPos;
    }
    delete host.dataset.qlUnsavedHost;
  }
}

function removeFieldBorder(el) {
  const key = fieldKey(el);
  if (key && routeKeyForRegistry) {
    unmarkLocalUnsavedField(routeKeyForRegistry, key);
  }
  el.classList.remove(FIELD_CLASS);
  delete el.dataset.localUnsaved;
  removeFieldIcon(el);
}

function triangleSvg() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("ql-local-unsaved-mark-icon");
  const path = document.createElementNS(ns, "path");
  path.setAttribute(
    "d",
    "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

function placeFieldMark(mark, el, host) {
  const hostRect = host.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const top = elRect.top - hostRect.top + host.scrollTop + 2;
  const left = elRect.right - hostRect.left + host.scrollLeft - 16;
  mark.style.top = `${Math.max(0, top)}px`;
  mark.style.left = `${Math.max(0, left)}px`;
  mark.style.right = "auto";
}

function makeTipButton({ forField, forSection }) {
  const mark = document.createElement("button");
  mark.type = "button";
  mark.className = MARK_CLASS;
  if (forSection) {
    mark.classList.add(SECTION_MARK_CLASS);
    mark.dataset.forSection = forSection;
  }
  if (forField) {
    mark.dataset.forField = forField;
  }
  mark.dataset.tip = TIP;
  mark.setAttribute("aria-label", TIP);
  mark.tabIndex = 0;
  mark.appendChild(triangleSvg());
  mark.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  return mark;
}

/** Border only — used inside sections (icon lives on the section). */
function ensureFieldBorder(el) {
  el.classList.add(FIELD_CLASS);
  el.dataset.localUnsaved = "true";
  const key = fieldKey(el);
  if (key && routeKeyForRegistry) {
    markLocalUnsavedField(routeKeyForRegistry, key);
  }
  removeFieldIcon(el);
}

/** Border + corner tip — small forms without a section wrapper. */
function ensureFieldMarkWithIcon(el) {
  const host = ensureFieldHost(el);
  if (!host) {
    return;
  }
  ensureFieldBorder(el);
  const key = fieldKey(el) || String(Math.random());
  let mark = [...host.querySelectorAll(`:scope > .${MARK_CLASS}:not(.${SECTION_MARK_CLASS})`)].find(
    (m) => m.dataset.forField === key,
  );
  if (!mark) {
    mark = makeTipButton({ forField: key });
    host.appendChild(mark);
  } else {
    mark.dataset.tip = TIP;
  }
  placeFieldMark(mark, el, host);
}

function removeSectionMark(section) {
  const sk = sectionRegistryKey(section);
  if (sk && routeKeyForRegistry) {
    unmarkLocalUnsavedField(routeKeyForRegistry, sk);
  }
  section.classList.remove("ql-local-unsaved-section");
  const mark = [...section.querySelectorAll(`:scope > .${SECTION_MARK_CLASS}`)].find(
    (m) => !sk || m.dataset.forSection === sk,
  );
  mark?.remove();
  if (
    section.dataset.qlUnsavedPos === "1" &&
    !section.querySelector(`.${FIELD_CLASS}`) &&
    !section.querySelector(`.${SECTION_MARK_CLASS}`)
  ) {
    section.style.position = "";
    delete section.dataset.qlUnsavedPos;
    delete section.dataset.qlUnsavedHost;
  }
}

/** Hide tip while editing inside section; keep section border if fields still dirty. */
function hideSectionTip(section) {
  for (const mark of section.querySelectorAll(`:scope > .${SECTION_MARK_CLASS}`)) {
    mark.remove();
  }
}

function ensureSectionMark(section) {
  const sk = sectionRegistryKey(section);
  if (!sk) {
    return;
  }
  ensureRelativeHost(section);
  section.classList.add("ql-local-unsaved-section");
  if (routeKeyForRegistry) {
    markLocalUnsavedField(routeKeyForRegistry, sk);
  }
  let mark = [...section.querySelectorAll(`:scope > .${SECTION_MARK_CLASS}`)].find(
    (m) => m.dataset.forSection === sk,
  );
  if (!mark) {
    mark = makeTipButton({ forSection: sk });
    section.appendChild(mark);
  } else {
    mark.dataset.tip = TIP;
  }
  mark.style.top = "0.35rem";
  mark.style.right = "0.35rem";
  mark.style.left = "auto";
}

function sectionHasDirtyFields(section) {
  return Boolean(section.querySelector?.(`.${FIELD_CLASS}`));
}

function syncSectionMark(section) {
  if (!section) {
    return;
  }
  if (sectionHasDirtyFields(section)) {
    ensureSectionMark(section);
  } else {
    removeSectionMark(section);
  }
}

function formAllowsDefaultMarks(node) {
  const form = node?.closest?.("[data-local-commit-form='true']");
  if (!form) {
    return false;
  }
  return (
    form.getAttribute("data-local-unsaved-defaults") === "true" ||
    form.getAttribute("data-local-draft-active") === "true"
  );
}

function markFilledInSection(section) {
  for (const el of section.querySelectorAll("input, textarea, select")) {
    if (isMarkableControl(el) && fieldHasValue(el)) {
      ensureFieldBorder(el);
    }
  }
}

/** Create-mode / restored-draft forms: mark every filled control (incl. defaults). */
function markFilledInDefaultForms(root) {
  const scope = root || document;
  for (const form of scope.querySelectorAll('[data-local-commit-form="true"]')) {
    if (
      form.getAttribute("data-local-unsaved-defaults") !== "true" &&
      form.getAttribute("data-local-draft-active") !== "true"
    ) {
      continue;
    }
    const nested = [...form.querySelectorAll(SECTION_SEL)];
    const sections = form.matches?.(SECTION_SEL) ? [form, ...nested] : nested;
    // de-dupe if form is also a section
    const unique = [...new Set(sections)];
    if (unique.length > 0) {
      for (const section of unique) {
        markFilledInSection(section);
        syncSectionMark(section);
      }
    } else {
      for (const el of form.querySelectorAll("input, textarea, select")) {
        if (isMarkableControl(el) && fieldHasValue(el)) {
          ensureFieldMarkWithIcon(el);
        }
      }
    }
  }
}

function clearAllMarks(root) {
  const scope = root || document;
  for (const el of scope.querySelectorAll?.(`.${FIELD_CLASS}`) ?? []) {
    el.classList.remove(FIELD_CLASS);
    delete el.dataset.localUnsaved;
  }
  for (const section of scope.querySelectorAll?.(".ql-local-unsaved-section") ?? []) {
    section.classList.remove("ql-local-unsaved-section");
  }
  for (const mark of scope.querySelectorAll?.(`.${MARK_CLASS}`) ?? []) {
    mark.remove();
  }
  for (const host of scope.querySelectorAll?.("[data-ql-unsaved-host='1']") ?? []) {
    if (host.dataset.qlUnsavedPos === "1") {
      host.style.position = "";
      delete host.dataset.qlUnsavedPos;
    }
    delete host.dataset.qlUnsavedHost;
  }
}

function reapplyMarksForRoute() {
  const root =
    document.querySelector('[data-page-scroll-owner="true"]') || document;
  const keys = listLocalUnsavedFields(routeKeyForRegistry);
  const sectionsToSync = new Set();
  for (const key of keys) {
    if (isSectionRegistryKey(key)) {
      const section = findSectionInRoot(root, key);
      if (section) {
        sectionsToSync.add(section);
      }
      continue;
    }
    const el = findControlInRoot(root, key);
    if (el && fieldHasValue(el)) {
      const section = nearestSection(el);
      if (section) {
        ensureFieldBorder(el);
        sectionsToSync.add(section);
      } else {
        ensureFieldMarkWithIcon(el);
      }
    }
  }
  for (const section of sectionsToSync) {
    syncSectionMark(section);
  }
  // Defaults + restored drafts: fill marks even when registry was empty (new tab)
  markFilledInDefaultForms(root);
}

function scheduleReapply() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      reapplyMarksForRoute();
      // Draft hydrate may paint after first rAF — one more pass
      window.setTimeout(() => {
        reapplyMarksForRoute();
      }, 80);
    });
  });
}

/**
 * Inside `[data-local-unsaved-section]`: fields get border only; one tip icon on
 * the section after focus leaves that section.
 * Outside sections (small forms): field keeps border + corner tip.
 * Only within `[data-local-commit-form]`.
 */
export function useLocalUnsavedFieldMarks() {
  const pathname = usePathname() ?? "";

  useEffect(() => {
    routeKeyForRegistry = pathname;
    scheduleReapply();

    const onFocusIn = (e) => {
      const t = e.target;
      if (!isMarkableControl(t)) {
        return;
      }
      t.dataset.qlFocusSnapshot = snapshotValue(t);
      const section = nearestSection(t);
      if (section) {
        // Working inside section — hide tip; keep border if still dirty
        hideSectionTip(section);
        if (sectionHasDirtyFields(section)) {
          section.classList.add("ql-local-unsaved-section");
        }
      }
    };

    const onBlur = (e) => {
      const t = e.target;
      if (!isMarkableControl(t)) {
        return;
      }
      const section = nearestSection(t);
      const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;
      window.setTimeout(() => {
        if (!t.isConnected) {
          return;
        }
        const before = t.dataset.qlFocusSnapshot;
        delete t.dataset.qlFocusSnapshot;
        const edited = before != null && before !== snapshotValue(t);
        const leavingSection = Boolean(section && (!related || !section.contains(related)));

        if (edited && fieldHasValue(t)) {
          if (section) {
            ensureFieldBorder(t);
          } else {
            ensureFieldMarkWithIcon(t);
          }
        } else if (!fieldHasValue(t)) {
          removeFieldBorder(t);
        }

        if (section && leavingSection) {
          // Include defaults the user never touched
          if (formAllowsDefaultMarks(section)) {
            markFilledInSection(section);
          }
          syncSectionMark(section);
        } else if (section && !leavingSection) {
          hideSectionTip(section);
          if (sectionHasDirtyFields(section)) {
            section.classList.add("ql-local-unsaved-section");
          }
        }
      }, 0);
    };

    const onClear = () => {
      clearAllMarks(document.querySelector('[data-page-scroll-owner="true"]') || document);
    };

    const onReapply = () => {
      scheduleReapply();
    };

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onBlur, true);
    window.addEventListener("quanluong:clear-local-unsaved-marks", onClear);
    window.addEventListener("quanluong:reapply-local-unsaved-marks", onReapply);
    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onBlur, true);
      window.removeEventListener("quanluong:clear-local-unsaved-marks", onClear);
      window.removeEventListener("quanluong:reapply-local-unsaved-marks", onReapply);
    };
  }, [pathname]);
}

export function clearLocalUnsavedFieldMarks() {
  clearLocalUnsavedFieldRegistry();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("quanluong:clear-local-unsaved-marks"));
  }
}

export function reapplyLocalUnsavedFieldMarks() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("quanluong:reapply-local-unsaved-marks"));
  }
}
