import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./api/kitchenBooksApi.js", import.meta.url), "utf8");

test("applying a sample sends the logical unit in its request body", () => {
  assert.match(
    source,
    /mutationFn: \(\{ id, \.\.\.body \}\) =>\s*apiRequest\(\{\s*url: `\/kitchen-books\/menu-samples\/\$\{id\}\/apply`,\s*method: "post",\s*data: body,/,
  );
});
