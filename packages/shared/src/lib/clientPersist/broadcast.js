const CHANNEL_NAME = "quanluong-client";

/** ponytail: singleton channel; no-op when BroadcastChannel missing */
function getChannel() {
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!getChannel._bc) {
    getChannel._bc = new BroadcastChannel(CHANNEL_NAME);
  }
  return getChannel._bc;
}

/** @param {{ type: "pageUi", id: string, savedAt: string }} msg */
export function postPageUiBroadcast(msg) {
  try {
    getChannel()?.postMessage({ type: "pageUi", id: msg.id, savedAt: msg.savedAt });
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ onNewerPageUi?: (msg: { id: string, savedAt: string }) => void }} opts
 * @returns {() => void}
 */
export function subscribePageUiBroadcast({ onNewerPageUi }) {
  const bc = getChannel();
  if (!bc) {
    return () => {};
  }
  const handler = (event) => {
    const data = event.data;
    if (data?.type !== "pageUi" || typeof data.id !== "string") {
      return;
    }
    onNewerPageUi?.({ id: data.id, savedAt: data.savedAt });
  };
  bc.addEventListener("message", handler);
  return () => bc.removeEventListener("message", handler);
}

/** v1 stub — Task 4 optional toast */
export function notifyPageUiStaleFromOtherTab() {
  /* no-op */
}
