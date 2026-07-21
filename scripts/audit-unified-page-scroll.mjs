import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["apps", "packages/shared/src"];
const SOURCE_EXTENSION = /\.(?:jsx?|tsx?)$/;
const VERTICAL_OVERFLOW = /\boverflow-(?:y-)?(?:auto|scroll)\b/;
const HARDCODED_STICKY_TOP = /\bsticky\b[^"'`\n]*\btop-(?:\d+|\[[^\]]+\])/;
const LOCAL_STICKY_ALLOWLIST = new Set([
  "packages/shared/src/pages/lttpNhapXuat/LttpOrderingTab.jsx",
]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.name !== "node_modules" && entry.name !== ".next")
      .map((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory()
          ? sourceFiles(target)
          : SOURCE_EXTENSION.test(entry.name)
            ? [target]
            : [];
      }),
  );
  return nested.flat();
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function openingTags(source) {
  return [...source.matchAll(/<[A-Za-z][^<>]*(?:\{[^{}]*\}[^<>]*)*>/gs)];
}

const failures = [];
for (const sourceRoot of SOURCE_ROOTS) {
  const directory = path.join(ROOT, sourceRoot);
  for (const file of await sourceFiles(directory)) {
    const relative = path.relative(ROOT, file);
    const source = await readFile(file, "utf8");

    for (const match of openingTags(source)) {
      const tag = match[0];
      if (
        VERTICAL_OVERFLOW.test(tag) &&
        !tag.includes("data-local-scroll") &&
        !tag.includes("data-page-scroll-owner")
      ) {
        failures.push(
          `${relative}:${lineNumber(source, match.index)} vertical scroll owner needs data-local-scroll or data-page-scroll-owner`,
        );
      }
    }

    if (
      HARDCODED_STICKY_TOP.test(source) &&
      !LOCAL_STICKY_ALLOWLIST.has(relative)
    ) {
      const match = source.match(HARDCODED_STICKY_TOP);
      failures.push(
        `${relative}:${lineNumber(source, match.index)} hard-coded sticky top offset is not registry-driven`,
      );
    }

    if (
      relative.startsWith("apps/") &&
      source.includes("data-sticky-level") &&
      !source.includes("UnifiedPageScrollRoot")
    ) {
      failures.push(`${relative}: sticky marker is outside a unified scroll root`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Unified page scroll audit passed.");
}
