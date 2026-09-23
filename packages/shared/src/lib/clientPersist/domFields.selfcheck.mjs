/**
 * node packages/shared/src/lib/clientPersist/domFields.selfcheck.mjs
 */
import assert from "node:assert/strict";
import { fieldKeyForControl, shouldPersistControl } from "./domFields.js";
import { buildRouteHref, shouldRestoreLastRoute } from "./lastRoute.js";
import { normalizeScrollMap } from "./scrollMap.js";

assert.equal(
  shouldPersistControl({ tagName: "INPUT", type: "text", dataset: {} }),
  true,
);
assert.equal(
  shouldPersistControl({ tagName: "INPUT", type: "password", dataset: {} }),
  false,
);
assert.equal(
  shouldPersistControl({ tagName: "INPUT", type: "text", dataset: { noPersist: "true" } }),
  false,
);
assert.equal(
  fieldKeyForControl({
    tagName: "INPUT",
    name: "title",
    dataset: {},
    getAttribute: (k) => (k === "name" ? "title" : null),
  }),
  "n:title",
);
assert.equal(fieldKeyForControl({ tagName: "INPUT", id: "x", dataset: {} }), "i:x");
assert.equal(
  fieldKeyForControl({ tagName: "INPUT", dataset: { persistKey: "custom" } }),
  "k:custom",
);

assert.equal(buildRouteHref("/a", "?b=1"), "/a?b=1");
assert.equal(shouldRestoreLastRoute("/", "/lttp-nhap-xuat"), true);
assert.equal(shouldRestoreLastRoute("/lttp-nhap-xuat", "/users"), false);
assert.equal(shouldRestoreLastRoute("/", "/"), false);
assert.equal(shouldRestoreLastRoute("/dashboard", "/dashboard/units"), true);

assert.deepEqual(normalizeScrollMap(120), { page: 120 });
assert.deepEqual(normalizeScrollMap({ page: 10, "s:x": 5 }), { page: 10, "s:x": 5 });
assert.deepEqual(normalizeScrollMap(null), {});

console.log("domFields + lastRoute selfcheck: ok");
