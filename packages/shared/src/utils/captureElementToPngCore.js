/**
 * Logic chụp PNG — không phụ thuộc npm `html-to-image`; app Next truyền `deps.toBlob`.
 *
 * @param {HTMLElement} root
 * @param {object} [opts]
 * @param {{ toBlob: (node: HTMLElement, options?: object) => Promise<Blob | null> }} deps
 * @returns {Promise<Blob>}
 */
export async function captureElementToPngBlobWithDeps(root, opts = {}, deps) {
  const toBlob = deps?.toBlob;
  if (typeof toBlob !== "function") {
    throw new Error("captureElementToPngBlobWithDeps: thiếu deps.toBlob (chỉ dùng từ app Next có html-to-image).");
  }

  const {
    tableScrollSelector = "[data-lttp-ordering-table-scroll]",
    cardSelector = "[data-lttp-ordering-card]",
    pixelRatio = 2,
  } = opts;

  const scrollEl = root.querySelector(tableScrollSelector);
  const card = root.querySelector(cardSelector);

  const restores = [];

  const push = (el, key, value) => {
    if (!el) return;
    const prev = el.style.getPropertyValue(key);
    const priority = el.style.getPropertyPriority(key);
    el.style.setProperty(key, value, "important");
    restores.push(() => {
      if (prev) el.style.setProperty(key, prev, priority);
      else el.style.removeProperty(key);
    });
  };

  try {
    if (scrollEl) {
      const fullW = scrollEl.scrollWidth;
      push(scrollEl, "overflow", "visible");
      push(scrollEl, "width", `${fullW}px`);
    }
    if (card) {
      push(card, "overflow", "visible");
      push(card, "max-width", "none");
    }
    push(root, "max-width", "none");

    const tableW = scrollEl?.scrollWidth ?? 0;
    const minRootW = tableW + 8;
    if (minRootW > root.offsetWidth) {
      push(root, "width", `${minRootW}px`);
    }

    void root.offsetWidth;

    const w = Math.max(root.scrollWidth, root.offsetWidth, tableW || 0);
    const h = Math.max(root.scrollHeight, root.offsetHeight);

    const blob = await toBlob(root, {
      pixelRatio: Math.min(pixelRatio, 3),
      backgroundColor: "#ffffff",
      width: w,
      height: h,
      cacheBust: true,
    });

    if (!blob) {
      throw new Error("Không tạo được ảnh.");
    }
    return blob;
  } finally {
    for (let i = restores.length - 1; i >= 0; i -= 1) {
      restores[i]();
    }
  }
}

/** @param {Blob} blob @param {string} filename */
export function downloadBlobAsFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Mobile: sheet chia sẻ. Desktop: tải file.
 * @returns {Promise<"shared" | "downloaded" | "cancelled">}
 */
export async function shareOrDownloadPng(blob, filename) {
  try {
    if (typeof navigator !== "undefined" && typeof File !== "undefined" && navigator.canShare) {
      const file = new File([blob], filename, { type: "image/png" });
      const payload = { files: [file] };
      if (navigator.canShare(payload)) {
        await navigator.share(payload);
        return "shared";
      }
    }
  } catch (e) {
    const err = /** @type {{ name?: string, code?: number }} */ (e);
    if (err?.name === "AbortError" || err?.code === 20) return "cancelled";
  }
  downloadBlobAsFile(blob, filename);
  return "downloaded";
}
