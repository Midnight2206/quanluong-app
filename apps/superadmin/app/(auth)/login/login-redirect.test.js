import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, "page.jsx"), "utf8");

test("SA login page redirects to main origin login", () => {
  assert.match(src, /getMainAppOrigin/);
  assert.match(src, /window\.location\.replace/);
  assert.doesNotMatch(src, /LoginPage/);
});
