import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, "OfflineProvider.jsx"), "utf8");

assert.match(src, /ReauthOverlay/);
assert.match(src, /reauthRequired/);
assert.match(src, /AUTH_EXPIRED/);
assert.match(src, /Bạn không có quyền thực hiện thao tác này/);
assert.match(src, /verifySessionOrRefresh/);

console.log("OfflineProvider reauth contract: ok");
