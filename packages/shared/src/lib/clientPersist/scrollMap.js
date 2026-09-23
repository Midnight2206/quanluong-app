/**
 * Nested scroll capture helpers for private-shell UI persist.
 */

import { positionalFieldKey } from "./domFields.js";

/**
 * @param {Element | null | undefined} el
 * @returns {boolean}
 */
export function isScrollContainer(el) {
  if (!(el instanceof Element)) {
    return false;
  }
  if (el.hasAttribute("data-page-scroll-owner") || el.hasAttribute("data-local-scroll")) {
    return true;
  }
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
    return false;
  }
  const style = window.getComputedStyle(el);
  const oy = style.overflowY;
  if (oy !== "auto" && oy !== "scroll" && oy !== "overlay") {
    return false;
  }
  return el.scrollHeight > el.clientHeight + 1;
}

/**
 * @param {Element} root
 * @param {Element} el
 * @returns {string | null}
 */
export function scrollKeyFor(root, el) {
  if (!(el instanceof Element)) {
    return null;
  }
  if (el.hasAttribute("data-page-scroll-owner")) {
    return "page";
  }
  const explicit = el.getAttribute("data-scroll-persist") || el.getAttribute("data-local-scroll");
  if (explicit && explicit !== "true") {
    return `s:${explicit}`;
  }
  if (el.hasAttribute("data-local-scroll")) {
    return positionalFieldKey(root, el) ? `s:${positionalFieldKey(root, el)}` : null;
  }
  const pos = positionalFieldKey(root, el);
  return pos ? `s:${pos}` : null;
}

/**
 * @param {Element | null | undefined} root
 * @returns {Record<string, number>}
 */
export function collectScrollMap(root) {
  /** @type {Record<string, number>} */
  const out = {};
  if (!(root instanceof Element)) {
    return out;
  }
  const visit = (el) => {
    if (!isScrollContainer(el)) {
      return;
    }
    const key = scrollKeyFor(root, el);
    if (!key) {
      return;
    }
    out[key] = el.scrollTop;
  };
  visit(root);
  for (const el of root.querySelectorAll("*")) {
    visit(el);
  }
  return out;
}

/**
 * Normalize persisted scroll (legacy number → map).
 * @param {unknown} scroll
 * @returns {Record<string, number>}
 */
export function normalizeScrollMap(scroll) {
  if (typeof scroll === "number" && Number.isFinite(scroll)) {
    return { page: scroll };
  }
  if (!scroll || typeof scroll !== "object" || Array.isArray(scroll)) {
    return {};
  }
  /** @type {Record<string, number>} */
  const out = {};
  for (const [k, v] of Object.entries(scroll)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * @param {Element | null | undefined} root
 * @param {unknown} scroll
 */
export function applyScrollMap(root, scroll) {
  const map = normalizeScrollMap(scroll);
  if (!(root instanceof Element) || !Object.keys(map).length) {
    return;
  }
  const byKey = new Map();
  const visit = (el) => {
    if (!isScrollContainer(el) && !el.hasAttribute("data-page-scroll-owner")) {
      return;
    }
    const key = scrollKeyFor(root, el);
    if (key) {
      byKey.set(key, el);
    }
  };
  visit(root);
  for (const el of root.querySelectorAll("*")) {
    visit(el);
  }
  for (const [key, top] of Object.entries(map)) {
    const el = byKey.get(key);
    if (el) {
      el.scrollTop = top;
    }
  }
}
