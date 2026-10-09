import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPERADMIN_PORTAL_CHOOSER_PATH,
  isLttpSupplierUser,
  isSuperadminUser,
  navigateAfterLogin,
  resolvePostLoginPath,
  safeInternalPath,
  supplierChooserHandoff,
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
    "http://localhost:8082/",
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

test("supplierChooserHandoff sends supplier users to one external url", () => {
  const result = supplierChooserHandoff(
    { type: { name: "lttp_supplier" } },
    "http://localhost:8082",
  );
  assert.deepEqual(result, { external: "http://localhost:8082/" });
  assert.equal("internal" in result, false);
});

test("supplierChooserHandoff sends admin users home with no external url", () => {
  const result = supplierChooserHandoff({ type: { name: "admin" } }, "http://localhost:8082");
  assert.deepEqual(result, { internal: "/" });
  assert.equal("external" in result, false);
});

test("supplierChooserHandoff keeps superadmin on the chooser", () => {
  assert.deepEqual(
    supplierChooserHandoff({ type: { name: "superadmin" } }, "http://localhost:8082"),
    { stay: true },
  );
});
