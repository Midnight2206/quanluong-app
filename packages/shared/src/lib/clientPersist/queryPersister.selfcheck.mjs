import assert from "node:assert/strict";
import { shouldDehydrateQuery } from "./queryPersister.js";

assert.equal(shouldDehydrateQuery({ queryKey: ["lttp", "commodities", "1"] }), true);
assert.equal(shouldDehydrateQuery({ queryKey: ["lttp", "issueSlips", "1"] }), false);
assert.equal(shouldDehydrateQuery({ queryKey: ["lttp", "priceTables", "1"] }), false);
assert.equal(shouldDehydrateQuery({ queryKey: ["auth", "currentUser"] }), false);
assert.equal(shouldDehydrateQuery({ queryKey: ["lttp", "dailyOrderSummary"] }), false);

console.log("queryPersister.selfcheck ok");
