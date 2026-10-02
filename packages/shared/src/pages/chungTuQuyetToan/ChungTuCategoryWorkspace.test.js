import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./ChungTuCategoryWorkspace.jsx", import.meta.url),
  "utf8",
);

test("category workspace always defines four ordered subtabs and gates summary by hasSummary", () => {
  assert.match(source, /config\?\.hasSummary/);
  assert.match(source, /id:\s*"export"/);
  assert.match(source, /id:\s*"summary"/);
  assert.match(source, /id:\s*"history"/);
  assert.match(source, /id:\s*"signature-settings"/);
  assert.match(
    source,
    /id:\s*"export"[\s\S]*id:\s*"summary"[\s\S]*id:\s*"history"[\s\S]*id:\s*"signature-settings"/,
  );
  assert.match(source, /disabled:\s*!config\?\.hasSummary/);
  assert.doesNotMatch(source, /\.\.\.\(isBkmh/);
});

test("export workspace opts out of local unsaved marks; signature settings does not", () => {
  const exportSource = readFileSync(
    new URL("./ChungTuExportWorkspace.jsx", import.meta.url),
    "utf8",
  );
  const signatureSource = readFileSync(
    new URL("./ChungTuSignatureSettingsWorkspace.jsx", import.meta.url),
    "utf8",
  );
  assert.match(exportSource, /data-no-unsaved-mark=["']true["']/);
  assert.match(exportSource, /data-local-commit-form=["']true["']/);
  assert.match(signatureSource, /data-local-commit-form=["']true["']/);
  assert.doesNotMatch(signatureSource, /data-no-unsaved-mark=["']true["']/);
});
