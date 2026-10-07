import { readFile } from "node:fs/promises";
import path from "node:path";
import { statfs } from "node:fs/promises";
import {
  WATCHED_CONTAINERS,
  classifyBackupLog,
  classifyContainer,
  classifyDisk,
} from "./system-infra.classify.js";
import { listWatchedContainers } from "./system-infra.docker.js";

function unknownDocker() {
  return WATCHED_CONTAINERS.map((name) => ({
    name,
    status: "unknown",
    message: "Không đọc được Docker",
  }));
}

async function readHostDisk() {
  const dir = process.env.INFRA_HOST_ROOT || "/host";
  const stat = await statfs(dir);
  const bsize = Number(stat.bsize);
  const totalBytes = Number(stat.blocks) * bsize;
  const freeBytes = Number(stat.bavail) * bsize;
  return { totalBytes, usedBytes: totalBytes - freeBytes };
}

async function readBackupLog() {
  const root = process.env.BACKUP_DIR || "/var/backups/quanluong";
  return readFile(path.join(root, "backup.log"), "utf8");
}

async function readInfra(deps = {}) {
  const now = deps.now ?? new Date();
  const readDisk = deps.readDisk ?? readHostDisk;
  const readLog = deps.readLog ?? readBackupLog;
  const listContainers = deps.listContainers ?? listWatchedContainers;

  let diskInput = { totalBytes: 0, usedBytes: 0 };
  try {
    diskInput = await readDisk();
  } catch {
    diskInput = { totalBytes: 0, usedBytes: 0 };
  }

  let log = null;
  try {
    log = await readLog();
  } catch {
    log = null;
  }

  let containers;
  try {
    const found = await listContainers();
    containers = WATCHED_CONTAINERS.map((name) => {
      const row = found.get(name) ?? null;
      return { name, ...classifyContainer(row ? { status: row.status, health: row.health ?? null } : null) };
    });
  } catch {
    containers = unknownDocker();
  }

  return {
    checkedAt: now.toISOString(),
    disk: classifyDisk(diskInput),
    backup: classifyBackupLog(log, now),
    containers,
  };
}

export { readInfra, readHostDisk, readBackupLog };
