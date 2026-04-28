"use client";

import { toBlob } from "html-to-image";
import {
  captureElementToPngBlobWithDeps,
  downloadBlobAsFile,
  shareOrDownloadPng,
} from "../../../../packages/shared/src/utils/captureElementToPngCore.js";

export async function captureElementToPngBlob(root, opts) {
  return captureElementToPngBlobWithDeps(root, opts, { toBlob });
}

export { downloadBlobAsFile, shareOrDownloadPng };
