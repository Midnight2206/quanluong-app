import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./KitchenMenuTab.jsx", import.meta.url), "utf8");

test("saving a sample refreshes its filtered list before counting", () => {
  assert.match(source, /import \{ useQueryClient \} from "@tanstack\/react-query";/);
  assert.match(
    source,
    /await queryClient\.refetchQueries\(\{\s*queryKey: qk\.kitchenBooks\.menuSamples\(selectedUnitId, mealPeriod, rateId\),\s*\}\);/,
  );
  assert.match(
    source,
    /const refreshedSamples = queryClient\.getQueryData\(qk\.kitchenBooks\.menuSamples\(selectedUnitId, mealPeriod, rateId\)\) \?\? \[\];/,
  );
  assert.match(source, /Hiện có \$\{refreshedSamples\.length\} mẫu cho buổi và mức này\./);
});

test("changing units or loading an invalid rate clears the selected rate", () => {
  assert.match(source, /import \{ useEffect, useRef, useState \} from "react";/);
  assert.match(source, /const previousUnitId = useRef\(selectedUnitId\);/);
  assert.match(source, /previousUnitId\.current !== selectedUnitId/);
  assert.match(source, /setRateId\(null\);/);
  assert.match(source, /needsMealRateSelection \|\| !mealMeta\.rates\.some\(\(rate\) => rate\.id === rateId\)/);
});
