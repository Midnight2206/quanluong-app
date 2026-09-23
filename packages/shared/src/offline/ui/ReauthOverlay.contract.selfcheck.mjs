import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, "ReauthOverlay.jsx"), "utf8");

assert.match(src, /Phiên hết hạn, đăng nhập lại/);
assert.match(src, /useLoginMutation/);
assert.match(src, /loginSchema/);
assert.match(src, /onSuccess/);
assert.doesNotMatch(src, /google\/login/i);

console.log("ReauthOverlay contract: ok");
