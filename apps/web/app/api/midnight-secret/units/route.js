import { NextResponse } from "next/server";
import { assertMidnightGate, prepareMidnightProxy } from "../../../../lib/midnightSecretProxy.js";
import { MIDNIGHT_TAB_READ_CODES } from "../../../../lib/midnightSecretServer.js";

export async function GET(request) {
  const cookie = request.headers.get("cookie") || "";
  const gateErr = assertMidnightGate(request, cookie);
  if (gateErr) {
    return gateErr;
  }
  const prepared = await prepareMidnightProxy({
    cookie,
    permissionCodes: MIDNIGHT_TAB_READ_CODES,
    requireUnit: false,
  });
  if (prepared.errorResponse) {
    return prepared.errorResponse;
  }
  const r = await fetch(`${prepared.base}/midnight-secret/units`, {
    headers: prepared.headers,
    cache: "no-store",
  });
  const json = await r.json().catch(() => ({}));
  return NextResponse.json(json, { status: r.status });
}
