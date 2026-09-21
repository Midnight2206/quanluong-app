import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const serviceSource = readFileSync(new URL("./lttp.service.js", import.meta.url), "utf8");
const validatorSource = readFileSync(new URL("./lttp.validator.js", import.meta.url), "utf8");

test("issue form defaults no longer accept CSS print layout fields", () => {
  assert.match(serviceSource, /function mapIssueFormDefaultsRow/);
  assert.doesNotMatch(
    serviceSource,
    /function mapIssueFormDefaultsRow[\s\S]*?marginTopCm/,
  );
  assert.doesNotMatch(
    serviceSource,
    /function mapIssueFormDefaultsRow[\s\S]*?printFontId/,
  );
  assert.doesNotMatch(validatorSource, /marginTopCm|printFontId|printFontSizePt/);
});
