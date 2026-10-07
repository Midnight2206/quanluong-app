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


const SLOT_MINUTES = 2 * 60 + 15;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

function zonedParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + Number(parts.minute),
  };
}

function slotDay(now) {
  const parts = zonedParts(now);
  if (parts.minutes >= SLOT_MINUTES) return parts.day;
  return zonedParts(new Date(now.getTime() - 24 * 60 * 60 * 1000)).day;
}

function classifyBackupLog(log, now) {
  if (log == null) {
    return { status: "unknown", message: "Không đọc được log backup", lastSuccessDay: null };
  }
  const attempts = [];
  let lastSuccessDay = null;
  for (const raw of String(log).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const iso = /^(\d{4}-\d{2}-\d{2}T\S+)/.exec(line);
    const at = iso ? new Date(iso[1]) : null;
    const started = /backup bắt đầu day=(\d{4}-\d{2}-\d{2})/.exec(line);
    if (started) {
      attempts.push({
        day: started[1],
        at: at && !Number.isNaN(at.getTime()) ? at : null,
        outcome: "open",
      });
      continue;
    }
    if (!line.includes("backup xong") && !line.includes("BACKUP_FAILED")) continue;
    const open = attempts.findLast((item) => item.outcome === "open");
    if (!open) continue;
    open.outcome = line.includes("BACKUP_FAILED") ? "fail" : "ok";
    if (open.outcome === "ok") lastSuccessDay = open.day;
  }
  const slot = slotDay(now);
  const latest = attempts.at(-1);
  if (!latest || (latest.outcome === "ok" && latest.day < slot)) {
    return {
      status: "warn",
      message: "Chưa có backup xong cho mốc 02:15 gần nhất",
      lastSuccessDay,
    };
  }
  if (latest.outcome === "open") {
    const age = latest.at ? now.getTime() - latest.at.getTime() : Number.POSITIVE_INFINITY;
    if (latest.day >= slot && age >= 0 && age < THREE_HOURS_MS) {
      return { status: "warn", message: "Backup đang chạy", lastSuccessDay };
    }
    return {
      status: "warn",
      message: "Backup bắt đầu nhưng không thấy kết thúc",
      lastSuccessDay,
    };
  }
  if (latest.outcome === "fail") {
    return {
      status: "warn",
      message: `Backup lỗi ngày ${latest.day}`,
      lastSuccessDay,
    };
  }
  return {
    status: "ok",
    message: `Backup xong ngày ${latest.day}`,
    lastSuccessDay,
  };
}

export { WATCHED_CONTAINERS, classifyDisk, classifyContainer, classifyBackupLog };
