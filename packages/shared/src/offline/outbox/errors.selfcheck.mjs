import assert from "node:assert/strict";
import { isAuthExpired, isForbidden, isClientError } from "./errors.js";

assert.equal(isAuthExpired({ status: 401 }), true);
assert.equal(isForbidden({ status: 403 }), true);
assert.equal(isClientError({ status: 401 }), false);
assert.equal(isClientError({ status: 403 }), false);
assert.equal(isClientError({ status: 422 }), true);
assert.equal(isClientError({ status: 503 }), false);
assert.equal(isClientError({}), false);

console.log("outbox errors: ok");
