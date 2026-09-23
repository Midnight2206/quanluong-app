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
const FIELD_CLASS = "ql-local-unsaved";

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
  if (el.closest?.("[data-no-persist-root='true']")) {
    return false;
  }
  if (el.dataset?.noPersist === "true" || el.dataset?.noUnsavedMark === "true") {
    return false;
  }
  if (tag === "INPUT") {
    const type = String(el.type || "text").toLowerCase();
    if (SKIP_TYPES.has(type)) {
      return false;
    }
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

function ensureHost(el) {
  let host =
    el.closest?.("[data-unsaved-mark-host]") ||
    el.closest?.("label") ||
    el.parentElement;
  if (!host || host === document.body) {
    host = el.parentElement;
  }
  if (!host) {
    return null;
  }
  if (host.dataset.qlUnsavedHost !== "1") {
    const pos = typeof window !== "undefined" ? window.getComputedStyle(host).position : "static";
    if (pos === "static") {
      host.style.position = "relative";
      host.dataset.qlUnsavedPos = "1";
    }
    host.dataset.qlUnsavedHost = "1";
  }
  return host;
}

function fieldKey(el) {
  return el.dataset.persistKey || el.name || el.id || "";
}

function attrSelector(attr, value) {
  const safe = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[${attr}="${safe}"]`;
}

function findControlInRoot(root, key) {
  if (!root || !key) {
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

function removeMark(el) {
  const key = fieldKey(el);
  if (key && routeKeyForRegistry) {
    unmarkLocalUnsavedField(routeKeyForRegistry, key);
  }
  el.classList.remove(FIELD_CLASS);
  delete el.dataset.localUnsaved;
  const host = el.closest?.("[data-ql-unsaved-host='1']") || el.parentElement;
  if (!host) {
    return;
  }
  const mark = [...host.querySelectorAll(`:scope > .${MARK_CLASS}`)].find(
    (m) => m.dataset.forField === key,
  );
  mark?.remove();
  if (!host.querySelector(`.${FIELD_CLASS}`)) {
    if (host.dataset.qlUnsavedPos === "1") {
      host.style.position = "";
      delete host.dataset.qlUnsavedPos;
    }
    delete host.dataset.qlUnsavedHost;
  }
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

function placeMark(mark, el, host) {
  const hostRect = host.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const top = elRect.top - hostRect.top + host.scrollTop + 2;
  const left = elRect.right - hostRect.left + host.scrollLeft - 16;
  mark.style.top = `${Math.max(0, top)}px`;
  mark.style.left = `${Math.max(0, left)}px`;
  mark.style.right = "auto";
}

function ensureMark(el) {
  const host = ensureHost(el);
  if (!host) {
    return;
  }
  el.classList.add(FIELD_CLASS);
  el.dataset.localUnsaved = "true";
  const key = fieldKey(el) || String(Math.random());
  if (fieldKey(el) && routeKeyForRegistry) {
    markLocalUnsavedField(routeKeyForRegistry, fieldKey(el));
  }
  let mark = [...host.querySelectorAll(`:scope > .${MARK_CLASS}`)].find(
    (m) => m.dataset.forField === key,
  );
  if (!mark) {
    mark = document.createElement("button");
    mark.type = "button";
    mark.className = MARK_CLASS;
    mark.dataset.forField = key;
    mark.dataset.tip = TIP;
    mark.setAttribute("aria-label", TIP);
    mark.tabIndex = 0;
    mark.appendChild(triangleSvg());
    mark.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    host.appendChild(mark);
  } else {
    mark.dataset.tip = TIP;
  }
  placeMark(mark, el, host);
}

function clearAllMarks(root) {
  const scope = root || document;
  for (const el of scope.querySelectorAll?.(`.${FIELD_CLASS}`) ?? []) {
    removeMark(el);
  }
  for (const mark of scope.querySelectorAll?.(`.${MARK_CLASS}`) ?? []) {
    mark.remove();
  }
}

function reapplyMarksForRoute() {
  const root =
    document.querySelector('[data-page-scroll-owner="true"]') || document;
  const keys = listLocalUnsavedFields(routeKeyForRegistry);
  for (const key of keys) {
    const el = findControlInRoot(root, key);
    if (el && fieldHasValue(el)) {
      ensureMark(el);
    }
  }
}

function scheduleReapply() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      reapplyMarksForRoute();
    });
  });
}

/**
 * After blur: mark user-edited local fields with warning ring + corner tip icon.
 * Registry survives route change; marks reapply after draft hydrate.
 * Dispatch `quanluong:clear-local-unsaved-marks` after server save.
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
    };

    const onBlur = (e) => {
      const t = e.target;
      if (!isMarkableControl(t)) {
        return;
      }
      // defer so React controlled value is committed
      window.setTimeout(() => {
        if (!t.isConnected) {
          return;
        }
        const before = t.dataset.qlFocusSnapshot;
        delete t.dataset.qlFocusSnapshot;
        const edited = before != null && before !== snapshotValue(t);
        if (!edited && !t.classList.contains(FIELD_CLASS)) {
          return;
        }
        if (edited && fieldHasValue(t)) {
          ensureMark(t);
        } else if (!fieldHasValue(t)) {
          removeMark(t);
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
