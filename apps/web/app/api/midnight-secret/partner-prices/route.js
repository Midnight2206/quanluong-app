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
    permissionCodes: ["midnight.prices.read"],
    preferredUnitId: searchParams.get("unitId"),
  });
  if (prepared.errorResponse) {
    return prepared.errorResponse;
  }
  const r = await fetch(`${prepared.base}/midnight-secret/partner-prices${search}`, {
    headers: prepared.headers,
    cache: "no-store",
  });
  const json = await r.json().catch(() => ({}));
  return NextResponse.json(json, { status: r.status });
}

export async function PUT(request) {
  const cookie = request.headers.get("cookie") || "";
  const gateErr = assertMidnightGate(request, cookie);
  if (gateErr) {
    return gateErr;
  }
  const body = await request.json().catch(() => ({}));
  const prepared = await prepareMidnightProxy({
    cookie,
    permissionCodes: ["midnight.prices.write"],
    preferredUnitId: body?.unitId,
  });
  if (prepared.errorResponse) {
    return prepared.errorResponse;
  }
  const r = await fetch(`${prepared.base}/midnight-secret/partner-prices`, {
    method: "PUT",
    headers: {
      ...prepared.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await r.json().catch(() => ({}));
  return NextResponse.json(json, { status: r.status });
}
