import fs from "node:fs/promises";
import path from "node:path";

export function emptyBook() {
  return { units: {} };
}

export async function readDoc(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeDoc(file, doc) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(doc)}\n`);
  await fs.rename(tmp, file);
}

// ponytail: one gateway process, last write wins. Queue these updates if two ticks overlap.
export async function updateJson(file, fallback, change) {
  const current = await readDoc(file, fallback);
  const result = await change(current);
  await writeDoc(file, result.doc);
  return result;
}

export function putUnit(doc, unitId, bucket) {
  return { units: { ...(doc.units || {}), [String(unitId)]: bucket } };
}
