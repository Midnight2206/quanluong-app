import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sharedSrc = join(dirname(fileURLToPath(import.meta.url)), "../src");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const subpath = specifier.slice(2);
    const base = join(sharedSrc, subpath);
    for (const candidate of [`${base}.js`, `${base}.jsx`, base]) {
      try {
        return await nextResolve(pathToFileURL(candidate).href, context);
      } catch {
        // try next extension
      }
    }
  }
  return nextResolve(specifier, context);
}
