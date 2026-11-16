import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SUPERADMIN_PORTAL_CHOOSER_PATH,
  isLttpSupplierUser,
  isSuperadminBrowserHost,
  isSuperadminUser,
  navigateAfterLogin,
  publicOnlyRedirectPath,
  resolvePostLoginPath,
  safeInternalPath,
  supplierChooserHandoff,
} from "./postLoginPath.js";

test("safeInternalPath rejects open redirects and maps / to dashboard", () => {
  assert.equal(safeInternalPath("https://evil.example"), "/dashboard");
  assert.equal(safeInternalPath("//evil"), "/dashboard");
  assert.equal(safeInternalPath("/"), "/dashboard");
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
  assert.equal(resolvePostLoginPath({ type: { name: "user" } }, null), "/dashboard");
});

test("resolvePostLoginPath sends supplier to shared home /", () => {
  assert.equal(isLttpSupplierUser({ type: { name: "lttp_supplier" } }), true);
  assert.equal(isLttpSupplierUser({ type: { name: "admin" } }), false);
  assert.equal(
    resolvePostLoginPath({ type: { name: "lttp_supplier" } }, "/dashboard"),
    "/",
  );
  assert.equal(
    resolvePostLoginPath({ type: { name: "lttp_supplier" } }, "/"),
    "/",
  );
  assert.equal(
    resolvePostLoginPath({ type: { name: "lttp_supplier" } }, "/ncc-dathang"),
    "/ncc-dathang",
  );
  assert.equal(
    resolvePostLoginPath({ type: { name: "lttp_supplier" } }, "/ncc/dat-hang"),
    "/ncc-dathang",
  );
});

test("navigateAfterLogin uses assign for absolute http urls", () => {
  const calls = [];
  navigateAfterLogin("https://example.com/x", {
    assign(value) {
      calls.push(["assign", value]);
    },
    replace(value) {
      calls.push(["replace", value]);
    },
  });
  assert.deepEqual(calls, [["assign", "https://example.com/x"]]);
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

test("supplierChooserHandoff sends supplier users to shared home", () => {
  const result = supplierChooserHandoff({ type: { name: "lttp_supplier" } });
  assert.deepEqual(result, { internal: "/" });
  assert.equal("external" in result, false);
});

test("supplierChooserHandoff sends admin users home with no external url", () => {
  const result = supplierChooserHandoff({ type: { name: "admin" } });
  assert.deepEqual(result, { internal: "/dashboard" });
  assert.equal("external" in result, false);
});

test("public login redirect keeps superadmin on the chooser, not the main dashboard", () => {
  const main = { hostname: "quanluong.tail.ts.net", port: "" };
  const admin = { hostname: "admin-quanluong.example.com", port: "" };
  const devAdmin = { hostname: "localhost", port: "8081" };
  assert.equal(isSuperadminBrowserHost(main), false);
  assert.equal(isSuperadminBrowserHost(admin), true);
  assert.equal(isSuperadminBrowserHost(devAdmin), true);
  assert.equal(
    publicOnlyRedirectPath({ type: { name: "superadmin" } }, main),
    "/chon-cong",
  );
  assert.equal(
    publicOnlyRedirectPath({ type: { name: "superadmin" } }, admin),
    "/dashboard",
  );
  assert.equal(
    publicOnlyRedirectPath({ type: { name: "admin" } }, main),
    "/dashboard",
  );
});

test("superadmin redirect graph settles without a cross-host loop", () => {
  const main = { hostname: "quanluong.tail.ts.net", port: "" };
  const superadmin = { type: { name: "superadmin" } };
  const seen = [];
  let path = "/login";
  for (let i = 0; i < 6; i += 1) {
    seen.push(path);
    if (path === "/login" || path.startsWith("/login?")) {
      path = publicOnlyRedirectPath(superadmin, main);
      continue;
    }
    if (path === "/dashboard" || path.startsWith("/dashboard/")) {
      path = "/chon-cong";
      continue;
    }
    if (path === "/" || path.startsWith("/?")) {
      path = publicOnlyRedirectPath(superadmin, main);
      continue;
    }
    break;
  }
  assert.equal(path, "/chon-cong");
  assert.equal(seen.includes("https://admin-quanluong.tail.ts.net/dashboard"), false);
  assert.ok(seen.length <= 4);
});

test("workspace home and superadmin dashboard do not redirect to each other", () => {
  const dash = readFileSync(
    new URL("../pages/dashboard/SuperadminDashboardLayout.jsx", import.meta.url),
    "utf8",
  );
  const landing = readFileSync(new URL("../pages/home/MidnightLandingPage.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(dash, /ClientRedirect href="\/"/);
  assert.match(dash, /isSuperadminUser\(user\)/);
  assert.doesNotMatch(landing, /publicOnlyRedirectPath/);
  const superadmin = { type: { name: "superadmin" } };
  const main = { hostname: "quanluong.tail.ts.net", port: "" };
  assert.equal(publicOnlyRedirectPath(superadmin, main), "/chon-cong");
  assert.equal(isSuperadminUser(superadmin), true);
});

test("main dashboard does not bounce superadmin to another origin", () => {
  const src = readFileSync(new URL("../pages/dashboard/DashboardLayout.jsx", import.meta.url), "utf8");
  assert.match(src, /SUPERADMIN_PORTAL_CHOOSER_PATH/);
  assert.doesNotMatch(src, /window\.location\.replace/);
  assert.doesNotMatch(src, /getSuperadminAppOrigin/);
});

test("supplierChooserHandoff keeps superadmin on the chooser", () => {
  assert.deepEqual(supplierChooserHandoff({ type: { name: "superadmin" } }), { stay: true });
});

test("publicOnlyRedirectPath sends supplier to shared home /", () => {
  assert.equal(
    publicOnlyRedirectPath({ type: { name: "lttp_supplier" } }, { hostname: "localhost", port: "8080" }),
    "/",
  );
});
