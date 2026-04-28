/**
 * Bản không bundle `html-to-image` — build Next đổi toàn module này thành
 * `apps/{web,superadmin}/src/lttp-next/captureElementToPng.js` (xem resolve.alias trong next.config.mjs).
 */
export { downloadBlobAsFile, shareOrDownloadPng } from "./captureElementToPngCore.js";

export async function captureElementToPngBlob() {
  throw new Error(
    "Đang không chạy trong Next.js hoặc thiếu alias: packages/shared/src/utils/captureElementToPng.js → apps/*/src/lttp-next/captureElementToPng.js",
  );
}
