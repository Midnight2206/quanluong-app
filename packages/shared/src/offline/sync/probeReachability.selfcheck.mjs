import assert from "node:assert/strict";
import {
  PROBE_BACKOFF_MS,
  createReachabilityController,
} from "./probeReachability.js";

assert.deepEqual(PROBE_BACKOFF_MS, [2000, 5000, 10000, 30000]);

let browserOnline = false;
const browserListeners = new Set();
function emitBrowser(next) {
  browserOnline = next;
  for (const cb of browserListeners) cb(next);
}

const probes = [];
const ctrl = createReachabilityController({
  getBrowserOnline: () => browserOnline,
  subscribeBrowser: (cb) => {
    browserListeners.add(cb);
    cb(browserOnline);
    return () => browserListeners.delete(cb);
  },
  probe: async () => {
    const ok = probes.shift() ?? false;
    return ok;
  },
  now: () => 0,
  schedule: (fn, ms) => {
    // ponytail: microtask retries spin forever when probe keeps failing; use real delay
    const h = { cancelled: false };
    const id = setTimeout(() => {
      if (!h.cancelled) fn();
    }, ms);
    return () => {
      h.cancelled = true;
      clearTimeout(id);
    };
  },
});

const seen = [];
ctrl.subscribe((v) => seen.push(v));
ctrl.start();
assert.equal(ctrl.getOnline(), false);

probes.push(false);
emitBrowser(true);
await new Promise((r) => setTimeout(r, 20));
assert.equal(ctrl.getOnline(), false, "probe fail → still offline");

probes.push(true);
emitBrowser(false);
emitBrowser(true);
await new Promise((r) => setTimeout(r, 20));
assert.equal(ctrl.getOnline(), true, "probe ok → online");

emitBrowser(false);
assert.equal(ctrl.getOnline(), false, "browser offline → immediate offline");

ctrl.stop();
console.log("probeReachability: ok");
