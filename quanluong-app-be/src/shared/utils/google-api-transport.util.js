const RESILIENT_TRANSPORT_KEY = Symbol("googleResilientTransport");

export function isTransientGoogleTransportError(error) {
  const msg = String(error?.message ?? error ?? "");
  return /Premature close|ECONNRESET|ETIMEDOUT|socket hang up|fetch failed|network/i.test(msg);
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Retry googleapis/gaxios calls that fail with transient transport errors (common in Docker + undici).
 * Patches OAuth2Client.requestAsync — covers Drive, Sheets, and other Google APIs using that auth client.
 */
export function attachResilientGoogleTransport(oauth2Client, { attempts = 4, delayMs = 500 } = {}) {
  if (!oauth2Client || oauth2Client[RESILIENT_TRANSPORT_KEY]) {
    return oauth2Client;
  }

  const originalRequestAsync = oauth2Client.requestAsync.bind(oauth2Client);
  oauth2Client.requestAsync = async (requestOpts) => {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await originalRequestAsync(requestOpts);
      } catch (error) {
        lastError = error;
        if (attempt < attempts && isTransientGoogleTransportError(error)) {
          await sleep(delayMs * attempt);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  };

  oauth2Client[RESILIENT_TRANSPORT_KEY] = true;
  return oauth2Client;
}

export async function withGoogleApiRetry(fn, { attempts = 4, delayMs = 500 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts && isTransientGoogleTransportError(error)) {
        await sleep(delayMs * attempt);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
