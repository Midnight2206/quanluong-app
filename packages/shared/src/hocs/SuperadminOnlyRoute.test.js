import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const guard = readFileSync(new URL("./SuperadminOnlyRoute.jsx", import.meta.url), "utf8");

test("SuperadminOnlyRoute unauth uses main login", () => {
  assert.match(guard, /getMainAppOrigin/);
  assert.match(guard, /\/login/);
  assert.match(guard, /window\.location\.replace/);
  assert.doesNotMatch(guard, /\/login\?from=/);
});
