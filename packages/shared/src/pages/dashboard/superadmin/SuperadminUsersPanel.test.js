import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./SuperadminUsersPanel.jsx", import.meta.url),
  "utf8",
);

test("declares unitId state before deriving selected unit depth", () => {
  const stateDeclaration = source.indexOf("const [unitId, setUnitId] = useState");
  const derivedDepth = source.indexOf("const selectedUnitDepth = useMemo");

  assert.notEqual(stateDeclaration, -1);
  assert.notEqual(derivedDepth, -1);
  assert.ok(
    stateDeclaration < derivedDepth,
    "unitId must be initialized before it appears in the useMemo dependency array",
  );
});
