/**
 * Logic chụp PNG — không phụ thuộc npm `html-to-image`; app Next truyền `deps.toBlob`.
 *
 * @param {HTMLElement} root
 * @param {object} [opts]
 * @param {{ toBlob: (node: HTMLElement, options?: object) => Promise<Blob | null> }} deps
 * @returns {Promise<Blob>}
 */
/** @param {number} w @param {number} h @param {number} basePr */
function clampPixelRatioForOutputSize(w, h, basePr) {
  const safeW = Math.max(1, w);
  const safeH = Math.max(1, h);
  let pr = basePr;
  /** ~14MP ảnh đầu ra — giảm chậm / crash trên mobile khi bảng rất rộng */
  const maxOutputPx = 14_000_000;
  const est = safeW * safeH * pr * pr;
  if (est > maxOutputPx) {
    pr = Math.sqrt(maxOutputPx / (safeW * safeH));
  }
  return Math.max(1, Math.min(pr, 3));
}

export async function captureElementToPngBlobWithDeps(root, opts = {}, deps) {
  const toBlob = deps?.toBlob;
  if (typeof toBlob !== "function") {
    throw new Error("captureElementToPngBlobWithDeps: thiếu deps.toBlob (chỉ dùng từ app Next có html-to-image).");
  }

  const {
    tableScrollSelector = "[data-lttp-ordering-table-scroll]",
    cardSelector = "[data-lttp-ordering-card]",
    pixelRatio: pixelRatioOpt,
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
      // Remove viewport clipping so PNG captures the full table, not just current scrolled region.
      push(scrollEl, "max-height", "none");
      push(scrollEl, "height", "auto");
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

    const basePr =
      pixelRatioOpt ??
      (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 1023px)").matches
        ? 1.25
        : 2);
    const pixelRatio = clampPixelRatioForOutputSize(w, h, basePr);

    const blob = await toBlob(root, {
      pixelRatio,
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
 * Mobile: sheet chia sẻ. Desktop: thường tải file (trình duyệt không share file).
 * Nhiều app (vd. Zalo) có thể từ chối nhận file qua Web Share — khi đó fallback tải ảnh.
 * @returns {Promise<"shared" | "downloaded" | "downloaded_fallback" | "cancelled">}
 */
export async function shareOrDownloadPng(blob, filename) {
  const mime =
    blob?.type && typeof blob.type === "string" && blob.type.startsWith("image/") ? blob.type : "image/png";
  let shareAttempted = false;
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof File !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function"
    ) {
      const file = new File([blob], filename, { type: mime });
      const payload = { files: [file], title: filename.replace(/\.[^.]+$/, "") };
      if (navigator.canShare(payload)) {
        shareAttempted = true;
        await navigator.share(payload);
        return "shared";
      }
    }
  } catch (e) {
    const err = /** @type {{ name?: string, code?: number }} */ (e);
    if (err?.name === "AbortError" || err?.code === 20) return "cancelled";
    /** Share lỗi sau khi chọn app đích — fallback tải file */
  }
  downloadBlobAsFile(blob, filename);
  return shareAttempted ? "downloaded_fallback" : "downloaded";
}
