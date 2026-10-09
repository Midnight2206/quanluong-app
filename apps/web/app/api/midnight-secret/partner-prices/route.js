import { NextResponse } from "next/server";
import {
  getBackendBaseForMidnight,
  getCurrentUserUnitIdForMidnight,
  getMidnightSecretHeader,
  isMidnightGateCookieValid,
  midnightPermissionDenial,
  MIDNIGHT_GATE_COOKIE,
} from "../../../../lib/midnightSecretServer.js";

export async function GET(request) {
  const cookie = request.headers.get("cookie") || "";
  const denied = await midnightPermissionDenial(cookie, ["midnight.prices.read"]);
  if (denied) {
    return NextResponse.json(denied.body, { status: denied.status });
  }
  const c = request.cookies.get(MIDNIGHT_GATE_COOKIE);
  if (!isMidnightGateCookieValid(c?.value, cookie)) {
    return NextResponse.json(
      { success: false, error: { message: "Chưa mở khóa trang" } },
      { status: 401 },
    );
  }
  const secret = getMidnightSecretHeader();
  if (!secret) {
    return NextResponse.json(
      { success: false, error: { message: "Chưa cấu hình MIDNIGHT_SECRET_PASSWORD" } },
      { status: 503 },
    );
  }
  const { search } = new URL(request.url);
  const base = getBackendBaseForMidnight();
  const current = await getCurrentUserUnitIdForMidnight(cookie);
  if (current.error) {
    return NextResponse.json(current.error, { status: current.status });
  }
  const r = await fetch(`${base}/midnight-secret/partner-prices${search}`, {
    headers: {
      "X-Midnight-Secret": secret,
      "X-Midnight-User-Unit-Id": String(current.unitId),
      Cookie: cookie,
    },
    cache: "no-store",
  });
  const json = await r.json().catch(() => ({}));
  return NextResponse.json(json, { status: r.status });
}

export async function PUT(request) {
  const cookie = request.headers.get("cookie") || "";
  const denied = await midnightPermissionDenial(cookie, ["midnight.prices.write"]);
  if (denied) {
    return NextResponse.json(denied.body, { status: denied.status });
  }
  const c = request.cookies.get(MIDNIGHT_GATE_COOKIE);
  if (!isMidnightGateCookieValid(c?.value, cookie)) {
    return NextResponse.json(
      { success: false, error: { message: "Chưa mở khóa trang" } },
      { status: 401 },
    );
  }
  const secret = getMidnightSecretHeader();
  if (!secret) {
    return NextResponse.json(
      { success: false, error: { message: "Chưa cấu hình MIDNIGHT_SECRET_PASSWORD" } },
      { status: 503 },
    );
  }
  const body = await request.json().catch(() => ({}));
  const base = getBackendBaseForMidnight();
  const current = await getCurrentUserUnitIdForMidnight(cookie);
  if (current.error) {
    return NextResponse.json(current.error, { status: current.status });
  }
  const r = await fetch(`${base}/midnight-secret/partner-prices`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Midnight-Secret": secret,
      "X-Midnight-User-Unit-Id": String(current.unitId),
      Cookie: cookie,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await r.json().catch(() => ({}));
  return NextResponse.json(json, { status: r.status });
}
