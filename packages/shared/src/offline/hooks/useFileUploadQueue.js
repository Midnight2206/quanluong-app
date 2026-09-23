"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OP_IMPORT_EXCEL, OP_UPLOAD_IMAGE } from "../outbox/operations.js";
import { useOfflineQueue } from "./useOfflineQueue.js";

const FILE_OPS = new Set([OP_UPLOAD_IMAGE, OP_IMPORT_EXCEL]);

/**
 * Outbox rows with blobs — exposes `previewUrl` via object URLs (revoked when synced/removed).
 */
export function useFileUploadQueue() {
  const queue = useOfflineQueue();
  const { items } = queue;
  const fileItems = useMemo(
    () => items.filter((i) => FILE_OPS.has(i.operation) || i.fileBlob != null),
    [items],
  );
  const [previewById, setPreviewById] = useState(/** @type {Record<string, string>} */ ({}));
  const previewByIdRef = useRef(previewById);
  previewByIdRef.current = previewById;

  useEffect(() => {
    setPreviewById((prev) => {
      const next = { ...prev };
      const active = new Set(fileItems.map((i) => i.id));

      for (const item of fileItems) {
        const keepPreview = item.fileBlob != null && item.status !== "synced";
        if (keepPreview && !next[item.id]) {
          next[item.id] = URL.createObjectURL(item.fileBlob);
        }
        if (!keepPreview && next[item.id]) {
          URL.revokeObjectURL(next[item.id]);
          delete next[item.id];
        }
      }

      for (const id of Object.keys(next)) {
        if (!active.has(id)) {
          URL.revokeObjectURL(next[id]);
          delete next[id];
        }
      }
      return next;
    });
  }, [fileItems]);

  useEffect(
    () => () => {
      for (const url of Object.values(previewByIdRef.current)) {
        URL.revokeObjectURL(url);
      }
    },
    [],
  );

  const fileQueue = useMemo(
    () =>
      fileItems.map((item) => ({
        ...item,
        previewUrl: previewById[item.id] ?? null,
      })),
    [fileItems, previewById],
  );

  return {
    ...queue,
    fileItems: fileQueue,
    filePendingCount: fileQueue.filter((i) => i.status === "pending" || i.status === "syncing").length,
  };
}
