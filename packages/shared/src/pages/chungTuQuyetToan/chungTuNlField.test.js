import assert from "node:assert/strict";
import test from "node:test";
import { isNlFieldNamedRange, resolveNlFieldKey } from "./chungTuNlField.js";

test("isNlFieldNamedRange matches only NL_FIELD named ranges", () => {
  assert.equal(isNlFieldNamedRange("NL_FIELD_can_cu_pnk"), true);
  assert.equal(isNlFieldNamedRange("FIELD_so"), false);
  assert.equal(isNlFieldNamedRange("can_cu_pnk"), false);
});

test("resolveNlFieldKey maps can_cu_pnk and rejects legacy FIELD aliases", () => {
  assert.equal(resolveNlFieldKey("NL_FIELD_can_cu_pnk"), "canCuPnk");
  assert.equal(resolveNlFieldKey("can_cu_pnk"), "canCuPnk");
  assert.equal(resolveNlFieldKey("FIELD_can_cu_bkmh"), "");
});
