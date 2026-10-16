import { NextResponse } from "next/server";
import { assertMidnightGate, prepareMidnightProxy } from "../../../../lib/midnightSecretProxy.js";

export async function GET(request) {
  const cookie = request.headers.get("cookie") || "";
  const gateErr = assertMidnightGate(request, cookie);
  if (gateErr) {
    return gateErr;
  }
  const { searchParams } = new URL(request.url);
  const prepared = await prepareMidnightProxy({
    cookie,
    permissionCodes: ["midnight.debts.read"],
    preferredUnitId: searchParams.get("unitId"),
  });
  if (prepared.errorResponse) {
    return prepared.errorResponse;
  }
  const r = await fetch(`${prepared.base}/midnight-secret/partner-debts`, {
    headers: prepared.headers,
    cache: "no-store",
  });
  const json = await r.json().catch(() => ({}));
  return NextResponse.json(json, { status: r.status });
}
