import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createScriptedRuntime } from "../src/scripted-runtime.js";
import { createServer } from "../src/server.js";
import { emptyBook, writeDoc } from "../src/json-doc.js";
import { draftSkill } from "../plugins/quanluong-skill-loop/logic.js";
import { remember } from "../plugins/quanluong-memory/logic.js";
import { addJob } from "../plugins/quanluong-schedule/logic.js";

async function start(script) {
  const home = await mkdtemp(path.join(tmpdir(), "dsh-plugin-"));
  const server = createServer({
    config: {
      token: "secret",
      runtime: "scripted",
      model: "mock-model",
      home,
      profile: "sdk-minimal",
      splitProfiles: false,
    },
    runtime: createScriptedRuntime(script),
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    home,
    url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      server.close();
      await once(server, "close");
    },
  };
}

async function send(url, method, pathname, body) {
  const response = await fetch(`${url}${pathname}`, {
    method,
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}

test("accepting a skill, reading memory, and running a child stay inside one unit", async () => {
  const seen = [];
  const app = await start({
    reply: (request) => {
      seen.push(request);
      return "Bao cao, khong ghi";
    },
  });
  try {
    const drafted = draftSkill(emptyBook(), {
      unitId: "unit-a",
      accountId: "user-1",
      name: "doi-soat",
      description: "doi soat",
      body: "Chi bao cao",
      id: "skl-1",
    });
    await writeDoc(path.join(app.home, "plugins", "skill-loop.json"), drafted.doc);
    const wrongUnit = await send(app.url, "POST", "/v1/plugins/skill-loop/skills/skl-1/accept", {
      unitId: "unit-b",
      accountId: "user-1",
    });
    assert.equal(wrongUnit.status, 404);
    const accepted = await send(app.url, "POST", "/v1/plugins/skill-loop/skills/skl-1/accept", {
      unitId: "unit-a",
      accountId: "user-1",
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.json.data.status, "active");
    const hidden = await send(app.url, "GET", "/v1/plugins/skill-loop/skills?unitId=unit-b&accountId=user-1");
    assert.deepEqual(hidden.json.data, []);

    let memory = emptyBook();
    memory = remember(memory, { unitId: "unit-a", accountId: "user-1" }, { text: "Ghi chu A", scope: "user", id: "m1" }).doc;
    memory = remember(memory, { unitId: "unit-b", accountId: "user-1" }, { text: "Ghi chu B", scope: "unit", id: "m2" }).doc;
    await writeDoc(path.join(app.home, "plugins", "memory.json"), memory);
    const visible = await send(app.url, "GET", "/v1/plugins/memory?unitId=unit-a&accountId=user-1");
    assert.deepEqual(visible.json.data.entries.map((item) => item.id), ["m1"]);
    const otherUser = await send(app.url, "GET", "/v1/plugins/memory?unitId=unit-a&accountId=user-2");
    assert.deepEqual(otherUser.json.data.entries, []);

    const child = await send(app.url, "POST", "/v1/plugins/subagents/run", {
      unitId: "unit-a",
      accountId: "user-1",
      role: "ledger-reader",
      task: "Doc so",
    });
    assert.equal(child.status, 200);
    assert.equal(child.json.data.persisted, false);
    assert.equal(child.json.data.writes, 0);
    assert.match(seen[0].system, /Không ghi cơ sở dữ liệu/);
    assert.match(seen[0].system, /read_ledger_day/);
    const missing = await send(app.url, "GET", `/v1/plugins/subagents/assignments/${child.json.data.id}?unitId=unit-b&accountId=user-1`);
    assert.equal(missing.status, 404);
  } finally {
    await app.close();
  }
});

test("a scheduled tick stores a report and does not keep numeric write fields", async () => {
  const seen = [];
  const app = await start({
    reply: (request) => {
      seen.push(request);
      return "Bao cao lich";
    },
  });
  try {
    const added = addJob(emptyBook(), {
      unitId: "unit-a",
      accountId: "user-1",
      cron: "* * * * *",
      prompt: "Bao cao ton",
      id: "job-1",
      nextRunAt: "2026-11-01T00:00:00.000Z",
    });
    await writeDoc(path.join(app.home, "plugins", "schedule.json"), added.doc);
    const ticked = await send(app.url, "POST", "/v1/plugins/schedule/tick", { now: "2026-11-01T00:00:00.000Z" });
    assert.equal(ticked.status, 200);
    assert.equal(ticked.json.data.reports[0].run.report, "Bao cao lich");
    assert.equal(ticked.json.data.reports[0].run.persisted, false);
    assert.equal(ticked.json.data.reports[0].run.writes, 0);
    assert.match(seen[0].system, /Không tự tính số liệu/);
    assert.equal(seen[0].unitId, "unit-a");
    const other = await send(app.url, "GET", "/v1/plugins/schedule/runs?unitId=unit-b&accountId=user-9");
    assert.deepEqual(other.json.data, []);
  } finally {
    await app.close();
  }
});

test("a disabled plugin route does not answer", async () => {
  const previous = process.env.DSH_PLUGIN_MEMORY;
  process.env.DSH_PLUGIN_MEMORY = "0";
  const app = await start();
  try {
    const res = await send(app.url, "GET", "/v1/plugins/memory?unitId=unit-a&accountId=user-1");
    assert.equal(res.status, 404);
    assert.equal(res.json.code, "PLUGIN_DISABLED");
    const flags = await send(app.url, "GET", "/v1/plugins");
    assert.equal(flags.json.data.find((item) => item.id === "memory").enabled, false);
  } finally {
    if (previous == null) delete process.env.DSH_PLUGIN_MEMORY;
    else process.env.DSH_PLUGIN_MEMORY = previous;
    await app.close();
  }
});
