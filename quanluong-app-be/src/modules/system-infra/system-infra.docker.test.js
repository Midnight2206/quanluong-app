import assert from "node:assert/strict";
import test from "node:test";
import { listWatchedContainers } from "./system-infra.docker.js";

test("list keeps only watched names and drops inspect env", async () => {
  const calls = [];
  const dockerGet = async (pathname) => {
    calls.push(pathname);
    if (pathname.startsWith("/containers/json")) {
      return [
        { Id: "db1", Names: ["/quanluong-app-db"] },
        { Id: "mig1", Names: ["/quanluong-app-be-migrate"] },
        { Id: "other", Names: ["/nginx"] },
      ];
    }
    if (pathname === "/containers/db1/json") {
      return {
        State: { Status: "running", Health: { Status: "healthy" } },
        Config: { Env: ["DB_PASSWORD=secret"] },
      };
    }
    throw new Error(pathname);
  };
  const found = await listWatchedContainers(dockerGet);
  assert.equal(found.size, 1);
  assert.deepEqual(found.get("quanluong-app-db"), { status: "running", health: "healthy" });
  assert.equal(JSON.stringify([...found.values()]).includes("secret"), false);
  assert.equal(calls.some((path) => path.includes("migrate")), false);
});
