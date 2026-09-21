import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const serviceSource = readFileSync(new URL("./lttp.service.js", import.meta.url), "utf8");
const controllerSource = readFileSync(new URL("./lttp.controller.js", import.meta.url), "utf8");

test("issue slip writes require caller unit equality", () => {
  assert.match(serviceSource, /assertIssueSlipLogicalUnitIsCallerUnit/);
  assert.match(serviceSource, /Chỉ được lập\/sửa phiếu xuất của đơn vị mình/);
  assert.match(
    serviceSource,
    /async function createIssueSlip\([\s\S]*?assertIssueSlipLogicalUnitIsCallerUnit\(unitId, callerUnitId\)/,
  );
  assert.match(
    serviceSource,
    /async function updateIssueSlip\([\s\S]*?assertIssueSlipLogicalUnitIsCallerUnit\(dataScope\.logicalUnitId, callerUnitId\)/,
  );
  assert.match(
    serviceSource,
    /async function deleteIssueSlip\([\s\S]*?assertIssueSlipLogicalUnitIsCallerUnit\(dataScope\.logicalUnitId, callerUnitId\)/,
  );
});

test("controllers pass req.user.unitId into issue slip write services", () => {
  assert.match(controllerSource, /createIssueSlip\([\s\S]*?req\.user\.unitId/);
  assert.match(controllerSource, /updateIssueSlip\([\s\S]*?req\.user\.unitId/);
  assert.match(controllerSource, /deleteIssueSlip\([\s\S]*?req\.user\.unitId/);
  assert.match(
    controllerSource,
    /resyncIssueSlipLinePricesFromEffectiveTable\([\s\S]*?req\.user\.unitId/,
  );
});
