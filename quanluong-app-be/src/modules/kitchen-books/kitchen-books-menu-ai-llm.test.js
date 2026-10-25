import assert from "node:assert/strict";
import test from "node:test";
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
