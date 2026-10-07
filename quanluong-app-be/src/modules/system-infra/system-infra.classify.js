const WATCHED_CONTAINERS = [
  "quanluong-app-be",
  "quanluong-app-be-worker-email",
  "quanluong-app-be-worker-media",
  "quanluong-app-db",
  "quanluong-app-redis",
  "quanluong-document-db",
  "quanluong-document",
  "quanluong-app-qdrant",
  "quanluong-backup",
  "quanluong-app-ui",
  "quanluong-app-ui-superadmin",
];

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v >= 1024 ** 3) {
    const gb = v / 1024 ** 3;
    const text = gb >= 10 ? String(Math.round(gb)) : String(Math.round(gb * 10) / 10);
    return `${text} GB`;
  }
  if (v >= 1024 ** 2) return `${Math.max(1, Math.round(v / 1024 ** 2))} MB`;
  return `${Math.max(0, Math.round(v / 1024))} KB`;
}

function classifyDisk({ totalBytes, usedBytes }) {
  const total = Number(totalBytes);
  const used = Number(usedBytes);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(used) || used < 0) {
    return {
      status: "unknown",
      message: "Không đọc được đĩa",
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      usedPercent: 0,
    };
  }
  const freeBytes = Math.max(0, total - used);
  const usedPercent = (used / total) * 100;
  let status = "ok";
  if (usedPercent >= 90) status = "down";
  else if (usedPercent >= 80) status = "warn";
  const shown = Math.round(usedPercent * 10) / 10;
  return {
    status,
    message: `Đã dùng ${formatBytes(used)} (${shown}%) — còn ${formatBytes(freeBytes)}`,
    totalBytes: total,
    usedBytes: used,
    freeBytes,
    usedPercent: shown,
  };
}

function classifyContainer(row) {
  if (!row) return { status: "down", message: "không thấy container" };
  if (row.status !== "running") return { status: "down", message: "đã dừng" };
  if (row.health === "healthy") return { status: "ok", message: "đang chạy khỏe" };
  if (row.health === "unhealthy") return { status: "down", message: "lỗi healthcheck" };
  if (row.health === "starting") return { status: "warn", message: "đang khởi động" };
  return { status: "ok", message: "đang chạy" };
}

export { WATCHED_CONTAINERS, classifyDisk, classifyContainer };
