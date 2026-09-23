/**
 * Documents markability rules for local-unsaved field warnings.
 * (DOM helpers stay private in the hook; this selfcheck locks the contract.)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "useLocalUnsavedFieldMarks.js"),
  "utf8",
);

assert.match(src, /data-local-commit-form='true'/);
assert.match(src, /data-ui-preference='true'/);
assert.match(src, /type === "search"/);
assert.match(src, /data-no-unsaved-mark/);
assert.match(src, /data-local-unsaved-section/);
assert.match(src, /SECTION_MARK_CLASS|ql-local-unsaved-section-mark/);
assert.match(src, /ensureFieldBorder/);
console.log("useLocalUnsavedFieldMarks contract: ok");
