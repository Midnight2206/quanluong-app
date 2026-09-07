import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPERADMIN_PORTAL_CHOOSER_PATH,
  isSuperadminUser,
  resolvePostLoginPath,
  safeInternalPath,
} from "./postLoginPath.js";

test("safeInternalPath rejects open redirects", () => {
  assert.equal(safeInternalPath("https://evil.example"), "/");
  assert.equal(safeInternalPath("//evil"), "/");
  assert.equal(safeInternalPath("/dashboard"), "/dashboard");
});

test("isSuperadminUser", () => {
  assert.equal(isSuperadminUser({ type: { name: "superadmin" } }), true);
  assert.equal(isSuperadminUser({ type: { name: "admin" } }), false);
  assert.equal(isSuperadminUser(null), false);
});

test("resolvePostLoginPath sends superadmin to chooser ignoring from", () => {
  assert.equal(
    resolvePostLoginPath({ type: { name: "superadmin" } }, "/users"),
    SUPERADMIN_PORTAL_CHOOSER_PATH,
  );
  assert.equal(SUPERADMIN_PORTAL_CHOOSER_PATH, "/chon-cong");
});

test("resolvePostLoginPath keeps safe from for others", () => {
  assert.equal(
    resolvePostLoginPath({ type: { name: "user" } }, "/profile"),
    "/profile",
  );
  assert.equal(resolvePostLoginPath({ type: { name: "user" } }, null), "/");
});
