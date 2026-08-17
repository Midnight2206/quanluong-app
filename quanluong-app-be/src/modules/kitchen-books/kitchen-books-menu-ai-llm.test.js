import assert from "node:assert/strict";
import test from "node:test";
import { completeMenuJson, extractJsonObject } from "./kitchen-books-menu-ai-llm.js";

test("extractJsonObject parses raw object", () => {
  const o = extractJsonObject('{"periods":{"sang":{"dishes":[]}}}');
  assert.deepEqual(o.periods.sang.dishes, []);
});

test("extractJsonObject strips fences", () => {
  const o = extractJsonObject('```json\n{"ok":true}\n```');
  assert.equal(o.ok, true);
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
