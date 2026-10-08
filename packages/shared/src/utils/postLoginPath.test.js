import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPERADMIN_PORTAL_CHOOSER_PATH,
  chooserDestination,
  isLttpSupplierUser,
  isSuperadminUser,
  navigateAfterLogin,
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

test("resolvePostLoginPath sends supplier to the supplier app and ignores from", () => {
  assert.equal(isLttpSupplierUser({ type: { name: "lttp_supplier" } }), true);
  assert.equal(isLttpSupplierUser({ type: { name: "admin" } }), false);
  assert.equal(
    resolvePostLoginPath(
      { type: { name: "lttp_supplier" } },
      "/dashboard",
      { supplierOrigin: "http://localhost:8082" },
    ),
    "http://localhost:8082/dat-hang",
  );
});

test("navigateAfterLogin uses assign for absolute http urls", () => {
  const calls = [];
  navigateAfterLogin("http://localhost:8082/dat-hang", {
    assign(value) {
      calls.push(["assign", value]);
    },
    replace(value) {
      calls.push(["replace", value]);
    },
  });
  assert.deepEqual(calls, [["assign", "http://localhost:8082/dat-hang"]]);
});

test("navigateAfterLogin uses replace for internal paths", () => {
  const calls = [];
  navigateAfterLogin("/profile", {
    assign(value) {
      calls.push(["assign", value]);
    },
    replace(value) {
      calls.push(["replace", value]);
    },
  });
  assert.deepEqual(calls, [["replace", "/profile"]]);
});

test("chooserDestination returns supplier, home, or chooser", () => {
  assert.equal(chooserDestination({ type: { name: "lttp_supplier" } }), "supplier");
  assert.equal(chooserDestination({ type: { name: "admin" } }), "home");
  assert.equal(chooserDestination({ type: { name: "superadmin" } }), "chooser");
});
