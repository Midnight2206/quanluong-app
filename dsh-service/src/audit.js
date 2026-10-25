import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export function createAuditLog(filePath) {
  return async function writeAudit(entry) {
    const line = `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`;
    await mkdir(path.dirname(filePath), { recursive: true });
    await appendFile(filePath, line, "utf8");
  };
}
