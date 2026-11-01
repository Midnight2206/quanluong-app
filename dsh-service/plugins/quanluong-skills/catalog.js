import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "skills");

function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) return null;
  const meta = {};
  for (const line of match[1].split("\n")) {
    const cut = line.indexOf(":");
    if (cut < 1) continue;
    meta[line.slice(0, cut).trim()] = line.slice(cut + 1).trim().replace(/^["']|["']$/g, "");
  }
  if (!meta.name || !meta.description) return null;
  return { ...meta, body: match[2].trim() };
}

export async function listSkills(dir = root) {
  const names = await readdir(dir);
  const skills = [];
  for (const name of names) {
    const file = path.join(dir, name, "SKILL.md");
    const text = await readFile(file, "utf8").catch(() => "");
    const parsed = parseFrontmatter(text);
    if (parsed) skills.push({ name: parsed.name, description: parsed.description });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadSkill(name, dir = root) {
  const safe = String(name || "").trim();
  if (!/^[a-z0-9-]{1,64}$/.test(safe)) return null;
  const text = await readFile(path.join(dir, safe, "SKILL.md"), "utf8").catch(() => "");
  return parseFrontmatter(text);
}
