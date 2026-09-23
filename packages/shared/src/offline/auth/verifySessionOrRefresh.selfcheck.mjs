import assert from "node:assert/strict";
import { verifySessionOrRefresh } from "./verifySessionOrRefresh.js";

const user = { id: 1, permissions: [] };

{
  const calls = [];
  const r = await verifySessionOrRefresh({
    apiRequest: async (opts) => {
      calls.push(opts.url);
      return user;
    },
    setAuthState: () => {},
    mapPermissionsFromUser: () => [],
  });
  assert.equal(r.ok, true);
  assert.equal(r.user.id, 1);
  assert.deepEqual(calls, ["/auth/current-user"]);
}

{
  const calls = [];
  let n = 0;
  const r = await verifySessionOrRefresh({
    apiRequest: async (opts) => {
      calls.push(`${opts.method}:${opts.url}`);
      n += 1;
      if (opts.url === "/auth/current-user" && n === 1) {
        throw { status: 401 };
      }
      if (opts.url === "/auth/refresh-token") return {};
      return user;
    },
    setAuthState: () => {},
    mapPermissionsFromUser: () => [],
  });
  assert.equal(r.ok, true);
  assert.ok(calls.includes("post:/auth/refresh-token"));
}

{
  const r = await verifySessionOrRefresh({
    apiRequest: async (opts) => {
      if (opts.url === "/auth/current-user") throw { status: 401 };
      throw { status: 401 };
    },
    setAuthState: () => {},
    mapPermissionsFromUser: () => [],
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "AUTH_EXPIRED");
}

console.log("verifySessionOrRefresh: ok");
