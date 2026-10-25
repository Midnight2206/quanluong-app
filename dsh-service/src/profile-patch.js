import path from "node:path";
import { SURFACE_FEATURES } from "../profiles/surfaces.js";

function quote(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function plugin(id, file) {
  return `    - id: ${id}\n      name: ${quote(file)}`;
}

/** Cordis --patch overlay. Paths are absolute so the loader does not resolve
 * them from the profile directory.
 */
export function renderProfilePatch(pluginsDir, surface) {
  const features = SURFACE_FEATURES[surface] || SURFACE_FEATURES.web;
  const file = (name) => path.join(pluginsDir, name, "index.js");
  const rows = [
    plugin("llm-openrouter", file("llm-openrouter")),
    plugin("quanluong-skills", file("quanluong-skills")),
    plugin("quanluong-audit", file("quanluong-audit")),
    plugin("quanluong-policy", file("quanluong-policy")),
  ];
  if (features.length) rows.splice(1, 0, plugin("quanluong-tools", file("quanluong-tools")));
  return `- insert:\n${rows.join("\n")}\n`;
}

export function featuresFor(surface) {
  return [...(SURFACE_FEATURES[surface] || SURFACE_FEATURES.web)];
}
