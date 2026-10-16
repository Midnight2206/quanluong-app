import assert from "node:assert/strict";
import { userHasAnyPermission, MIDNIGHT_TAB_READ_CODES } from "./midnightSecretServer.js";

assert.equal(userHasAnyPermission({ type: { name: "superadmin" }, permissions: [] }, MIDNIGHT_TAB_READ_CODES), true);
assert.equal(
  userHasAnyPermission(
    { type: { name: "user" }, permissions: [{ code: "midnight.prices.read" }] },
    MIDNIGHT_TAB_READ_CODES,
  ),
  true,
);
assert.equal(
  userHasAnyPermission({ type: { name: "user" }, permissions: [{ code: "users.read" }] }, MIDNIGHT_TAB_READ_CODES),
  false,
);
assert.equal(userHasAnyPermission(null, MIDNIGHT_TAB_READ_CODES), false);
console.log("midnightSecretServer.selfcheck ok");
