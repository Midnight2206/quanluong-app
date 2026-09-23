/**
 * Collect / apply DOM form values for private-shell UI persist.
 * Controlled React inputs need native setters + bubbled events.
 */

const SKIP_TYPES = new Set(["password", "file", "hidden", "submit", "button", "reset", "image"]);

function tagNameOf(el) {
  return String(el?.tagName || "").toUpperCase();
}

/**
 * @param {Element | { tagName?: string, type?: string, dataset?: DOMStringMap, disabled?: boolean }} el
 * @returns {boolean}
 */
export function shouldPersistControl(el) {
  if (el == null || typeof el !== "object") {
    return false;
  }
  const tag = tagNameOf(el);
  if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
    return false;
  }
  const ds = el.dataset;
  if (ds && (ds.noPersist === "true" || ds.noPersist === "")) {
    return false;
  }
  if (tag === "INPUT") {
    const type = String(el.type || "text").toLowerCase();
    if (SKIP_TYPES.has(type)) {
      return false;
    }
  }
  return true;
}

/**
 * @param {Element | { tagName?: string, name?: string, id?: string, dataset?: DOMStringMap, getAttribute?: Function }} el
 * @returns {string | null}
 */
export function fieldKeyForControl(el) {
  if (el == null || typeof el !== "object") {
    return null;
  }
  const explicit = el.dataset?.persistKey;
  if (explicit) {
    return `k:${explicit}`;
  }
  const name =
    typeof el.getAttribute === "function" ? el.getAttribute("name") : el.name ?? null;
  if (name) {
    return `n:${name}`;
  }
  if (el.id) {
    return `i:${el.id}`;
  }
  return null;
}

/**
 * Positional fallback when control has no name/id (stable within a given page DOM).
 * @param {Element} root
 * @param {Element} el
 */
export function positionalFieldKey(root, el) {
  if (!root || !el || !root.contains?.(el)) {
    return null;
  }
  const parts = [];
  let cur = el;
  while (cur && cur !== root) {
    const parent = cur.parentElement;
    if (!parent) {
      break;
    }
    const tag = String(cur.tagName || "").toLowerCase();
    const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
    const idx = Math.max(0, siblings.indexOf(cur));
    parts.unshift(`${tag}${idx}`);
    cur = parent;
  }
  return parts.length ? `p:${parts.join("/")}` : null;
}

/**
 * @param {Element} root
 * @param {Element} el
 */
export function resolveFieldKey(root, el) {
  return fieldKeyForControl(el) || positionalFieldKey(root, el);
}

/**
 * @param {ParentNode} root
 * @returns {Record<string, string | boolean>}
 */
export function collectDomFields(root) {
  /** @type {Record<string, string | boolean>} */
  const out = {};
  if (!root || typeof root.querySelectorAll !== "function") {
    return out;
  }
  const nodes = root.querySelectorAll("input, textarea, select");
  for (const el of nodes) {
    if (!shouldPersistControl(el)) {
      continue;
    }
    const key = resolveFieldKey(root, el);
    if (!key) {
      continue;
    }
    const type = String(el.type || "").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      if (type === "radio") {
        if (el.checked) {
          out[key] = el.value;
        }
      } else {
        out[key] = Boolean(el.checked);
      }
      continue;
    }
    out[key] = el.value;
  }
  return out;
}

/**
 * @param {HTMLElement} el
 * @param {string} value
 */
function setNativeValue(el, value) {
  const ctor =
    tagNameOf(el) === "TEXTAREA"
      ? globalThis.HTMLTextAreaElement
      : tagNameOf(el) === "SELECT"
        ? globalThis.HTMLSelectElement
        : globalThis.HTMLInputElement;
  const proto = ctor?.prototype;
  const desc = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
  if (desc?.set) {
    desc.set.call(el, value);
  } else {
    el.value = value;
  }
  if (typeof Event === "function") {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

/**
 * @param {ParentNode} root
 * @param {Record<string, string | boolean | null | undefined> | null | undefined} fields
 * @returns {number} applied count
 */
export function applyDomFields(root, fields) {
  if (!root || !fields || typeof fields !== "object") {
    return 0;
  }
  let applied = 0;
  const nodes = root.querySelectorAll("input, textarea, select");
  for (const el of nodes) {
    if (!shouldPersistControl(el)) {
      continue;
    }
    const key = resolveFieldKey(root, el);
    if (!key || !Object.prototype.hasOwnProperty.call(fields, key)) {
      continue;
    }
    const raw = fields[key];
    const type = String(el.type || "").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      if (type === "radio") {
        const next = String(raw ?? "") === el.value;
        if (el.checked !== next) {
          el.checked = next;
          if (typeof Event === "function") {
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
          applied += 1;
        }
      } else {
        const next = Boolean(raw);
        if (el.checked !== next) {
          el.checked = next;
          if (typeof Event === "function") {
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
          applied += 1;
        }
      }
      continue;
    }
    const next = raw == null ? "" : String(raw);
    if (el.value !== next) {
      setNativeValue(el, next);
      applied += 1;
    }
  }
  return applied;
}
