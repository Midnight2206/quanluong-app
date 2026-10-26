import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createScriptedRuntime } from "../src/scripted-runtime.js";
import { createServer } from "../src/server.js";
import { renderProfilePatch } from "../src/profile-patch.js";
import { decide } from "../plugins/quanluong-policy/index.js";
import { listSkills, loadSkill } from "../plugins/quanluong-skills/catalog.js";
import { publishSkills } from "../src/skills-publish.js";
import { readLedgerDay } from "../plugins/quanluong-tools/client.js";
import { streamOpenRouter, toOpenAiMessages } from "../plugins/llm-openrouter/adapter.js";
import { isBootFailure, responseFromRun } from "../src/sdk-runtime.js";

async function start(script) {
  const home = await mkdtemp(path.join(tmpdir(), "dsh-"));
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
  const port = server.address().port;
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    async close() {
      server.close();
      await once(server, "close");
    },
  };
}

async function send(url, method, pathname, body, headers = {}) {
  const response = await fetch(`${url}${pathname}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, text, json: text ? JSON.parse(text) : null, headers: response.headers };
}

test("health does not need a token", async () => {
  const app = await start();
  try {
    const res = await send(app.url, "GET", "/health");
    assert.equal(res.status, 200);
    assert.equal(res.json.status, "ok");
    assert.equal(res.json.dsh, "ready");
    assert.equal(res.json.runtime, "scripted");
  } finally {
    await app.close();
  }
});

test("session and message contract, including account isolation", async () => {
  const app = await start({ reply: (req) => `echo:${req.text}` });
  try {
    const denied = await send(app.url, "POST", "/v1/sessions", { accountId: "4", unitId: "7" });
    assert.equal(denied.status, 401);

    const created = await send(app.url, "POST", "/v1/sessions", { accountId: "4", unitId: "7", surface: "web" }, {
      authorization: "Bearer secret",
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.id, "session-acct-4-unit-7-web");

    const again = await send(app.url, "POST", "/v1/sessions", { accountId: "4", unitId: "7", surface: "web" }, {
      authorization: "Bearer secret",
    });
    assert.equal(again.json.id, created.json.id);

    const other = await send(app.url, "POST", `/v1/sessions/${created.json.id}/messages`, {
      accountId: "9",
      unitId: "7",
      text: "no",
    }, { authorization: "Bearer secret" });
    assert.equal(other.status, 403);

    const message = await send(app.url, "POST", `/v1/sessions/${created.json.id}/messages`, {
      accountId: "4",
      unitId: "7",
      text: "mua gao",
      system: "rules",
      grantId: "grant-1",
      feature: "kitchen-ledger-movement",
    }, { authorization: "Bearer secret" });
    assert.equal(message.status, 200);
    assert.equal(message.json.role, "assistant");
    assert.equal(message.json.engine, "dsh");
    assert.equal(message.json.content, "echo:mua gao");
    assert.equal(message.json.provider, "openrouter");
  } finally {
    await app.close();
  }
});

test("message can be read as SSE", async () => {
  const app = await start({ reply: () => "{\"records\":[]}" });
  try {
    const created = await send(app.url, "POST", "/v1/sessions", { accountId: "4", unitId: "8", surface: "supplier" }, {
      authorization: "Bearer secret",
    });
    const response = await fetch(`${app.url}/v1/sessions/${created.json.id}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        authorization: "Bearer secret",
      },
      body: JSON.stringify({ accountId: "4", unitId: "8", text: "hi" }),
    });
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/event-stream/);
    assert.match(text, /event: message/);
    assert.match(text, /event: done/);
    assert.match(text, /records/);
  } finally {
    await app.close();
  }
});

test("profile patch lists first-party plugins with absolute paths", () => {
  const patch = renderProfilePatch("/opt/plugins", "supplier");
  assert.match(patch, /llm-openrouter/);
  assert.match(patch, /quanluong-skills/);
  assert.match(patch, /quanluong-policy/);
  assert.match(patch, /\/opt\/plugins\/quanluong-tools\/index\.js/);
  const admin = renderProfilePatch("/opt/plugins", "superadmin");
  assert.equal(admin.includes("quanluong-tools"), false);
  assert.match(admin, /serverName: quanluong/);
  assert.match(admin, /\/opt\/src\/mcp-server\.js/);
  assert.equal(admin.includes("dev-dsh-token"), false);
});

test("policy denies host tools and commits", () => {
  assert.equal(decide({ name: "bash" }).kind, "deny");
  assert.equal(decide({ name: "propose_ledger_records", arguments: { commit: true } }).kind, "deny");
  assert.equal(decide({ name: "read_ledger_day", arguments: { grantId: "g" } }), null);
  assert.equal(decide({ name: "mcp__quanluong__read_ledger_day", arguments: { grantId: "g" } }), null);
  assert.equal(decide({ name: "mcp__other__bash" }).kind, "deny");
});

test("skills expose ledger, menu, and issue-slip rules", async () => {
  const skills = await listSkills();
  assert.deepEqual(skills.map((skill) => skill.name), [
    "explore-data",
    "issue-slip-rules",
    "ledger-extract",
    "ledger-rules",
    "menu-rules",
    "validate-data",
  ]);
  const ledger = await loadSkill("ledger-rules");
  assert.match(ledger.body, /do not write the ledger/i);
  const explore = await loadSkill("explore-data");
  const validate = await loadSkill("validate-data");
  const extract = await loadSkill("ledger-extract");
  assert.match(explore.body, /read_ledger_day/);
  assert.match(explore.body, /do not write/i);
  assert.match(validate.body, /negativeStock/);
  assert.match(validate.body, /do not write/i);
  assert.match(extract.body, /"records"/);
  assert.equal(explore.body.includes("matplotlib"), false);
  assert.equal(await loadSkill("../etc/passwd"), null);
  assert.equal(await loadSkill("data-visualization"), null);
  assert.equal(await loadSkill("statistical-analysis"), null);
  const home = await mkdtemp(path.join(tmpdir(), "dsh-skills-"));
  const published = await publishSkills(path.join(path.dirname(new URL(import.meta.url).pathname), "../plugins/quanluong-skills/skills"), home);
  const copied = await readFile(path.join(published, "explore-data", "SKILL.md"), "utf8");
  assert.match(copied, /name: explore-data/);
  const validateCopied = await readFile(path.join(published, "validate-data", "SKILL.md"), "utf8");
  assert.match(validateCopied, /name: validate-data/);
});

test("ledger tool client posts the grant and does not send a commit flag", async () => {
  let body;
  const data = await readLedgerDay({
    backendUrl: "http://app.test",
    token: "secret",
    grantId: "g1",
    date: "2026-10-21",
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return { ok: true, json: async () => ({ ok: true, data: { date: "2026-10-21" } }) };
    },
  });
  assert.equal(body.grantId, "g1");
  assert.equal(body.commit, undefined);
  assert.equal(data.date, "2026-10-21");
});

test("OpenRouter adapter emits usage before finish", async () => {
  const encoder = new TextEncoder();
  const sse = [
    'data: {"choices":[{"delta":{"content":"{\\"ok\\":true}"}}]}\n',
    'data: {"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n',
    "data: [DONE]\n",
  ].join("");
  const chunks = [];
  for await (const chunk of streamOpenRouter(
    {
      provider: "openrouter",
      model: "google/gemini-3.8-flash",
      temperature: 0,
      messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    },
    { baseURL: "https://openrouter.test/v1", apiKey: "key" },
    async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.max_tokens, 8000);
      assert.equal(body.temperature, 0);
      assert.equal(body.model, "google/gemini-3.8-flash");
      return {
        ok: true,
        body: {
          getReader() {
            let sent = false;
            return {
              async read() {
                if (sent) return { done: true };
                sent = true;
                return { done: false, value: encoder.encode(sse) };
              },
            };
          },
        },
      };
    },
  )) chunks.push(chunk);
  const types = chunks.map((chunk) => chunk.type);
  assert.ok(types.indexOf("usage") < types.indexOf("finish"));
  assert.equal(chunks.at(-1).type, "finish");
  assert.equal(chunks.find((chunk) => chunk.type === "usage").usage.inputTokens, 3);
  const messages = toOpenAiMessages({
    messages: [{ role: "user", content: [{ type: "text", text: "hi" }, { type: "image", data: "abc", mimeType: "image/jpeg" }] }],
  });
  assert.match(messages[0].content[1].image_url.url, /^data:image\/jpeg;base64,/);
});

test("MCP server lists read and draft tools and rejects a commit flag", async () => {
  const { Client } = await import("@modelcontextprotocol/client");
  const { StdioClientTransport } = await import("@modelcontextprotocol/client/stdio");
  const serverFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/mcp-server.js");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverFile],
    env: {
      ...process.env,
      LEDGER_TOOL_BACKEND_URL: "http://127.0.0.1:9",
      DSH_SERVICE_TOKEN: "t",
      QUANLUONG_TOOL_FEATURES: "ledger,menu,issue-slip",
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "quanluong-test", version: "0" });
  await client.connect(transport);
  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), [
      "propose_issue_slip_lines",
      "propose_ledger_records",
      "read_ledger_day",
      "read_menu_day",
    ]);
    const rejected = await client.callTool({
      name: "read_ledger_day",
      arguments: { grantId: "g", date: "2026-10-21", commit: true },
    });
    assert.equal(rejected.isError, true);
    assert.match(JSON.stringify(rejected), /commit/);
  } finally {
    await client.close();
  }
});

test("only boot failures are treated as DSH down", () => {
  assert.equal(isBootFailure(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })), true);
  assert.equal(isBootFailure(new Error("initialize timeout")), true);
  assert.equal(isBootFailure(new Error("model refused the schema")), false);
});

test("a DSH turn error is not an empty success", () => {
  assert.throws(
    () => responseFromRun({
      finalResponse: "",
      events: [{ type: "turn/end", data: { reason: { kind: "error", error: { message: "OpenRouter API key is missing" } } } }],
    }, "google/gemini-3.8-flash"),
    (error) => error.code === "MODEL_ERROR" && error.status === 500 && /API key/.test(error.message),
  );
  const ok = responseFromRun({
    finalResponse: "pong",
    events: [{ type: "turn/end", data: { reason: { kind: "stop" } } }],
  }, "google/gemini-3.8-flash");
  assert.equal(ok.content, "pong");
  assert.equal(ok.provider, "openrouter");
});
