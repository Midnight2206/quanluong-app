import { NextResponse } from "next/server";
import {
  getBackendBaseForMidnight,
  getCurrentUserUnitIdForMidnight,
  getMidnightSecretHeader,
  isMidnightGateCookieValid,
  MIDNIGHT_GATE_COOKIE,
} from "../../../../lib/midnightSecretServer.js";

export async function GET(request) {
  const c = request.cookies.get(MIDNIGHT_GATE_COOKIE);
  const cookie = request.headers.get("cookie") || "";
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
  const r = await fetch(`${base}/midnight-secret/lttp-partner-totals${search}`, {
    headers: { "X-Midnight-Secret": secret, "X-Midnight-User-Unit-Id": String(current.unitId) },
    cache: "no-store",
  });
  const json = await r.json().catch(() => ({}));
  return NextResponse.json(json, { status: r.status });
}
