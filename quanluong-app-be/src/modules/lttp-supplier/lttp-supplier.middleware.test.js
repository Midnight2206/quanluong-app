import assert from "node:assert/strict";
import test from "node:test";
import { superadminMiddleware } from "../../middlewares/superadmin.middleware.js";
import { lttpSupplierMiddleware } from "./lttp-supplier.middleware.js";

function runMiddleware(req) {
  const calls = [];
  lttpSupplierMiddleware(req, {}, (arg) => {
    calls.push(arg);
  });
  return calls;
}

function getGetRoute(router, path) {
  return router.stack.find((layer) => layer.route?.path === path && layer.route.methods.get);
}

function getRouteHandles(routeLayer) {
  return routeLayer.route.stack.map((layer) => layer.handle);
}

async function importSupplierRouter() {
  process.env.DATABASE_URL ??= "mysql://tester:secret@127.0.0.1:3306/quanluong_test";
  process.env.JWT_ACCESS_SECRET ??= "test-jwt-secret";
  process.env.SESSION_SECRET ??= "test-session-secret";
  return import("./lttp-supplier.routes.js");
}

test("lttpSupplierMiddleware allows lttp_supplier accounts", () => {
  const calls = runMiddleware({ user: { type: { name: "lttp_supplier" } } });
  assert.deepEqual(calls, [undefined]);
});

test("lttpSupplierMiddleware rejects admin accounts", () => {
  const calls = runMiddleware({ user: { type: { name: "admin" } } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].statusCode, 403);
  assert.equal(calls[0].message, "Chỉ tài khoản nhà cung cấp được thao tác này.");
});

test("lttpSupplierMiddleware rejects missing users", () => {
  const calls = runMiddleware({});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].statusCode, 403);
  assert.equal(calls[0].message, "Chỉ tài khoản nhà cung cấp được thao tác này.");
});

test("supplier router wires superadmin and supplier guards on GET routes", async () => {
  const { lttpSupplierRouter } = await importSupplierRouter();
  const { lttpSupplierMiddleware: routeSupplierMiddleware } = await import("./lttp-supplier.middleware.js");

  const catalogRoute = getGetRoute(lttpSupplierRouter, "/catalog");
  const userLinksRoute = getGetRoute(lttpSupplierRouter, "/users/:userId/links");
  const linksRoute = getGetRoute(lttpSupplierRouter, "/links");
  const ordersRoute = getGetRoute(lttpSupplierRouter, "/orders");

  assert.ok(catalogRoute);
  assert.ok(userLinksRoute);
  assert.ok(linksRoute);
  assert.ok(ordersRoute);

  assert.equal(getRouteHandles(catalogRoute).includes(superadminMiddleware), true);
  assert.equal(getRouteHandles(userLinksRoute).includes(superadminMiddleware), true);
  assert.equal(getRouteHandles(linksRoute).includes(routeSupplierMiddleware), true);
  assert.equal(getRouteHandles(ordersRoute).includes(routeSupplierMiddleware), true);
});
