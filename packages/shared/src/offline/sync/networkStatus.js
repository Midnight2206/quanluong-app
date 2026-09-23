import { createReachabilityController } from "./probeReachability.js";

let browserOnline =
  typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
    ? navigator.onLine
    : true;

/** @type {Set<(online: boolean) => void>} */
const browserListeners = new Set();
let browserWired = false;

function getBrowserOnline() {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    browserOnline = navigator.onLine;
  }
  return browserOnline;
}

function wireBrowser() {
  if (browserWired || typeof window === "undefined") {
    return;
  }
  browserWired = true;
  const sync = () => {
    const next = navigator.onLine;
    if (next === browserOnline) {
      return;
    }
    browserOnline = next;
    for (const cb of browserListeners) {
      cb(next);
    }
  };
  window.addEventListener("online", sync);
  window.addEventListener("offline", sync);
}

/** @param {(online: boolean) => void} cb @returns {() => void} */
function subscribeBrowser(cb) {
  wireBrowser();
  browserListeners.add(cb);
  cb(getBrowserOnline());
  return () => {
    browserListeners.delete(cb);
  };
}

let probeImpl = async () => {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
};

/** @param {() => Promise<boolean>} fn */
export function setNetworkProbeForTest(fn) {
  probeImpl = fn;
}

/** @param {() => Promise<boolean>} fn */
export function setNetworkProbe(fn) {
  probeImpl = fn;
}

const controller = createReachabilityController({
  getBrowserOnline,
  subscribeBrowser,
  probe: () => probeImpl(),
});

let started = false;

function ensureStarted() {
  if (started) {
    return;
  }
  started = true;
  controller.start();
}

/** @returns {boolean} */
export function getNetworkOnline() {
  ensureStarted();
  return controller.getOnline();
}

/** @param {(online: boolean) => void} cb @returns {() => void} */
export function subscribeNetworkStatus(cb) {
  ensureStarted();
  return controller.subscribe(cb);
}
