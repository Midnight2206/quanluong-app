import { NextResponse } from "next/server";
import { assertMidnightGate, prepareMidnightProxy } from "../../../../lib/midnightSecretProxy.js";

export async function GET(request) {
  const cookie = request.headers.get("cookie") || "";
  const gateErr = assertMidnightGate(request, cookie);
  if (gateErr) {
    return gateErr;
  }
  const { searchParams, search } = new URL(request.url);
  const prepared = await prepareMidnightProxy({
    cookie,
    permissionCodes: ["midnight.matrix.read"],
    preferredUnitId: searchParams.get("unitId"),
  });
  if (prepared.errorResponse) {
    return prepared.errorResponse;
  }
  const r = await fetch(`${prepared.base}/midnight-secret/lttp-partner-money-matrix${search}`, {
    headers: prepared.headers,
    cache: "no-store",
  });
  const json = await r.json().catch(() => ({}));
  return NextResponse.json(json, { status: r.status });
}
