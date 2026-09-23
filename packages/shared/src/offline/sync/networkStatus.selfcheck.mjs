import assert from "node:assert/strict";
import { getNetworkOnline, subscribeNetworkStatus } from "./networkStatus.js";

assert.equal(typeof getNetworkOnline(), "boolean");

const seen = [];
const unsub = subscribeNetworkStatus((v) => seen.push(v));
assert.equal(seen.length, 1);
assert.equal(typeof seen[0], "boolean");
unsub();

console.log("networkStatus: ok");
