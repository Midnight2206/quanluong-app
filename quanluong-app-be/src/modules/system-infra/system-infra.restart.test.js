import assert from "node:assert/strict";
import test from "node:test";
import { respondRestartAccepted } from "./system-infra.controller.js";
import {
  RESTARTABLE_CONTAINERS,
  restartContainer,
  scheduleSelfRestart,
} from "./system-infra.restart.js";

test("danh sách restart bỏ container backup", () => {
  assert.equal(RESTARTABLE_CONTAINERS.includes("quanluong-backup"), false);
  assert.equal(RESTARTABLE_CONTAINERS.includes("quanluong-app-db"), true);
  assert.equal(RESTARTABLE_CONTAINERS.length, 10);
});

test("tên không được phép thì 404 và không gọi docker", async () => {
  for (const name of ["quanluong-backup", "quanluong-app-be-migrate"]) {
    let called = false;
    await assert.rejects(
      restartContainer(name, {
        list: async () => {
          called = true;
          return new Map();
        },
        post: async () => {
          called = true;
          return 204;
        },
      }),
      (error) => {
        assert.equal(error.statusCode, 404);
        assert.equal(error.message, "Không restart container này.");
        return true;
      },
    );
    assert.equal(called, false);
  }
});

test("list lỗi thì 503 và không gọi post", async () => {
  let postCalled = false;
  await assert.rejects(
    restartContainer("quanluong-app-db", {
      list: async () => {
        throw new Error("docker down");
      },
      post: async () => {
        postCalled = true;
        return 204;
      },
    }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.message, "Không restart được container.");
      return true;
    },
  );
  assert.equal(postCalled, false);
});

test("không thấy container thì 404", async () => {
  await assert.rejects(
    restartContainer("quanluong-app-db", {
      list: async () => new Map(),
      post: async () => 204,
    }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.message, "Không thấy container.");
      return true;
    },
  );
});

test("restart db gọi đúng đường dẫn", async () => {
  const calls = [];
  const result = await restartContainer("quanluong-app-db", {
    list: async () => new Map([["quanluong-app-db", "db1"]]),
    post: async (pathname) => {
      calls.push(pathname);
      return 204;
    },
  });
  assert.equal(result.deferred, false);
  assert.deepEqual(calls, ["/containers/db1/restart?t=10"]);
});

test("restart api trả trước rồi mới gọi docker", async () => {
  let posted = false;
  const result = await restartContainer("quanluong-app-be", {
    list: async () => new Map([["quanluong-app-be", "app1"]]),
    post: async () => {
      posted = true;
      return 204;
    },
  });
  assert.equal(result.deferred, true);
  assert.equal(posted, false);
  const events = {};
  scheduleSelfRestart(
    { on(name, fn) { events[name] = fn; } },
    result.run,
    (fn) => fn(),
  );
  assert.equal(posted, false);
  events.finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(posted, true);
});

test("deferred restart đăng ký finish trước json", () => {
  const order = [];
  const res = {
    on(event) {
      if (event === "finish") {
        order.push("finish-listener");
      }
    },
    status(code) {
      order.push(`status:${code}`);
      return {
        json() {
          order.push("json");
        },
      };
    },
  };
  respondRestartAccepted(res, "quanluong-app-be", {
    deferred: true,
    run: () => {},
  });
  assert.deepEqual(order, ["finish-listener", "status:202", "json"]);
});
