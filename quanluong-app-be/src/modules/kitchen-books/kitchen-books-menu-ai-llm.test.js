import assert from "node:assert/strict";
import test from "node:test";
import { resetDshSessions } from "../ai-gateway/dsh-client.js";
import { completeMenuJson, extractJsonObject, extractStructured } from "./kitchen-books-menu-ai-llm.js";

test("extractJsonObject parses raw object", () => {
  const o = extractJsonObject('{"periods":{"sang":{"dishes":[]}}}');
  assert.deepEqual(o.periods.sang.dishes, []);
});

test("extractJsonObject strips fences", () => {
  const o = extractJsonObject('```json\n{"ok":true}\n```');
  assert.equal(o.ok, true);
});

test("completeMenuJson caps OpenRouter output at 8000 tokens", async () => {
  let body;
  const fetchImpl = async (_url, init) => {
    body = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
    };
  };
  await completeMenuJson(
    { system: "sys", user: "usr" },
    {
      fetchImpl,
      configOverride: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "https://example.test/v1",
        timeoutMs: 5000,
      },
    },
  );
  assert.equal(body.max_tokens, 8000);
});

test("completeMenuJson retries once on bad JSON", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not-json" } }],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"periods":{"sang":{"dishes":[]},"trua":{"dishes":[]},"chieu":{"dishes":[]}}}' } }],
      }),
    };
  };
  const out = await completeMenuJson(
    { system: "sys", user: "usr" },
    {
      fetchImpl,
      configOverride: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "https://example.test/v1",
        timeoutMs: 5000,
      },
    },
  );
  assert.equal(calls, 2);
  assert.ok(out.periods.sang);
});

const cfg = {
  provider: "openai",
  apiKey: "test-key",
  model: "gpt-test",
  baseUrl: "https://example.test/v1",
  timeoutMs: 5000,
};

test("extractStructured gửi nhiệt độ 0 và ảnh, không đổi completeMenuJson", async () => {
  let body;
  const out = await extractStructured(
    { system: "sys", user: "đếm", image: { mime: "image/jpeg", base64: "aGk=" }, temperature: 0 },
    {
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body);
        return { ok: true, json: async () => ({ choices: [{ message: { content: '{"days":[]}' } }] }) };
      },
      configOverride: cfg,
    },
  );
  assert.equal(body.temperature, 0);
  assert.equal(body.max_tokens, 8000);
  assert.equal(body.messages[1].content[1].image_url.url, "data:image/jpeg;base64,aGk=");
  assert.deepEqual(out.data, { days: [] });
  assert.equal(out.model, "gpt-test");
});

test("extractStructured dùng model của lượt gọi", async () => {
  let body;
  const out = await extractStructured(
    { system: "s", user: "u" },
    {
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body);
        return { ok: true, json: async () => ({ choices: [{ message: { content: '{"records":[]}' } }] }) };
      },
      configOverride: cfg,
      model: "google/gemini-3.5-flash",
    },
  );
  assert.equal(body.model, "google/gemini-3.5-flash");
  assert.equal(out.model, "google/gemini-3.5-flash");
});

test("extractStructured tắt khi thiếu khóa", async () => {
  await assert.rejects(
    () => extractStructured({ system: "s", user: "u" }, { configOverride: { ...cfg, apiKey: "" } }),
    (err) => err.statusCode === 503,
  );
});

const dshOpts = {
  engine: "dsh",
  dshServiceUrl: "http://dsh.test",
  dshServiceToken: "token",
};

test("menu JSON uses DSH and keeps the parsed shape", async () => {
  resetDshSessions();
  let direct = 0;
  const out = await completeMenuJson(
    { system: "sys", user: "usr" },
    {
      ...dshOpts,
      configOverride: cfg,
      fetchImpl: async () => {
        direct += 1;
        throw new Error("direct");
      },
      dshFetch: async (url) => {
        if (String(url).endsWith("/v1/sessions")) {
          return { ok: true, status: 201, json: async () => ({ id: "session-acct-system-unit-0-web" }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ content: '{"periods":{"sang":{"dishes":[]}}}' }),
        };
      },
    },
  );
  assert.equal(direct, 0);
  assert.ok(out.periods.sang);
});

test("menu JSON falls back to OpenRouter when DSH is down", async () => {
  resetDshSessions();
  let body;
  const out = await completeMenuJson(
    { system: "sys", user: "usr" },
    {
      ...dshOpts,
      configOverride: cfg,
      dshFetch: async () => {
        throw new Error("ECONNREFUSED");
      },
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body);
        return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
      },
    },
  );
  assert.equal(body.max_tokens, 8000);
  assert.equal(out.ok, true);
});

test("DSH auth failure does not call the direct model", async () => {
  resetDshSessions();
  let direct = 0;
  await assert.rejects(
    () => completeMenuJson(
      { system: "sys", user: "usr" },
      {
        ...dshOpts,
        configOverride: cfg,
        dshFetch: async () => ({ ok: false, status: 401, json: async () => ({ error: "Unauthorized" }) }),
        fetchImpl: async () => {
          direct += 1;
          return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
        },
      },
    ),
    (err) => err.statusCode === 502,
  );
  assert.equal(direct, 0);
});

test("a missing DSH session is opened once more", async () => {
  resetDshSessions();
  let sessions = 0;
  let messages = 0;
  const out = await completeMenuJson(
    { system: "sys", user: "usr" },
    {
      ...dshOpts,
      configOverride: cfg,
      fetchImpl: async () => {
        throw new Error("direct");
      },
      dshFetch: async (url) => {
        if (String(url).endsWith("/v1/sessions")) {
          sessions += 1;
          return { ok: true, status: 201, json: async () => ({ id: `session-${sessions}` }) };
        }
        messages += 1;
        if (messages === 1) {
          return { ok: false, status: 404, json: async () => ({ error: "Session not found" }) };
        }
        return { ok: true, status: 200, json: async () => ({ content: '{"ok":true}' }) };
      },
    },
  );
  assert.equal(sessions, 2);
  assert.equal(messages, 2);
  assert.equal(out.ok, true);
});
