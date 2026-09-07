import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serviceSrc = readFileSync(new URL("./lttp.service.js", import.meta.url), "utf8");

test("listRecipientUsers picks users from unit branch not exact unitId only", () => {
  assert.match(serviceSrc, /async function listRecipientUsers/);
  assert.match(serviceSrc, /resolveRecipientPickUnitIds/);
  const listFn = serviceSrc.slice(
    serviceSrc.indexOf("async function listRecipientUsers"),
    serviceSrc.indexOf("async function getRecipientDefaultUserByUnit"),
  );
  assert.match(listFn, /pickUnitIds/);
  assert.match(listFn, /unitId: \{ in: pickUnitIds \}/);
  assert.doesNotMatch(listFn, /where: \{ unitId, deletedAt: null, isActive: true \}/);
});

test("recipient validation uses assertRecipientUserAllowedForUnit", () => {
  assert.match(serviceSrc, /async function assertRecipientUserAllowedForUnit/);
  assert.match(serviceSrc, /assertRecipientUserAllowedForUnit\(userId, rid\)/);
  assert.match(serviceSrc, /assertRecipientUserAllowedForUnit\(ruId, recipientUnitId\)/);
});
