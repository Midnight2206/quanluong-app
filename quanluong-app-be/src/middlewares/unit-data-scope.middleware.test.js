import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const middlewareSource = readFileSync(new URL("./unit-data-scope.middleware.js", import.meta.url), "utf8");
const routesSource = readFileSync(
  new URL("../modules/lttp/lttp.routes.js", import.meta.url),
  "utf8",
);

test("unitDataScopeMiddleware supports resolveLogicalUnitFallback", () => {
  assert.match(middlewareSource, /resolveLogicalUnitFallback/);
  assert.match(middlewareSource, /fromRecord/);
});

test("print-pdf routes fall back to issue slip unitId", () => {
  assert.match(routesSource, /getIssueSlipUnitIdById/);
  assert.match(routesSource, /resolveIssueSlipLogicalUnitFromParams/);
  assert.match(routesSource, /resolveIssueSlipLogicalUnitFromPrintBatch/);
  assert.match(
    routesSource,
    /issue-slips\/:id\/print-pdf[\s\S]*?resolveLogicalUnitFallback:\s*resolveIssueSlipLogicalUnitFromParams/,
  );
  assert.match(
    routesSource,
    /issue-slips\/print-pdfs[\s\S]*?resolveLogicalUnitFallback:\s*resolveIssueSlipLogicalUnitFromPrintBatch/,
  );
});
