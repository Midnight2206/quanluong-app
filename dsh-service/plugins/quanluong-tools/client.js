export async function postTool(opts, pathname, payload) {
  const base = String(opts.backendUrl || "").replace(/\/+$/, "");
  if (!base || !opts.token) {
    const error = new Error("Backend tool URL or token is not set");
    error.code = "TOOL_UNAVAILABLE";
    throw error;
  }
  const response = await (opts.fetchImpl || globalThis.fetch)(`${base}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.token}`,
    },
    body: JSON.stringify(payload),
    signal: opts.signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    const error = new Error(body.error || `Tool HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body.data;
}

export function readLedgerDay(opts) {
  return postTool(opts, "/api/internal/dsh/tools/ledger/read", {
    grantId: opts.grantId,
    date: opts.date,
  });
}

export function proposeLedgerRecords(opts) {
  return postTool(opts, "/api/internal/dsh/tools/ledger/propose", {
    grantId: opts.grantId,
    date: opts.date,
    records: opts.records,
  });
}

export function readMenuDay(opts) {
  return postTool(opts, "/api/internal/dsh/tools/menu/read", {
    grantId: opts.grantId,
    date: opts.date,
  });
}

export function proposeIssueSlipLines(opts) {
  return postTool(opts, "/api/internal/dsh/tools/issue-slip/propose", {
    grantId: opts.grantId,
    lines: opts.lines,
  });
}
