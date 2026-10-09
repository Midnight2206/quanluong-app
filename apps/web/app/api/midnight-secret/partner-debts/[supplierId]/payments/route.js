import { NextResponse } from "next/server";
import {
  getBackendBaseForMidnight,
  getCurrentUserUnitIdForMidnight,
  getMidnightSecretHeader,
  isMidnightGateCookieValid,
  midnightPermissionDenial,
  MIDNIGHT_GATE_COOKIE,
} from "../../../../../../lib/midnightSecretServer.js";

function validateUnlocked(request) {
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
  return { secret, cookie };
}

export async function GET(request, { params }) {
  const cookie = request.headers.get("cookie") || "";
  const denied = await midnightPermissionDenial(cookie, ["midnight.debts.read"]);
  if (denied) {
    return NextResponse.json(denied.body, { status: denied.status });
  }
  const checked = validateUnlocked(request);
  if (checked instanceof NextResponse) {
    return checked;
  }
  const { supplierId } = await params;
  const base = getBackendBaseForMidnight();
  const current = await getCurrentUserUnitIdForMidnight(checked.cookie);
  if (current.error) {
    return NextResponse.json(current.error, { status: current.status });
  }
  const r = await fetch(`${base}/midnight-secret/partner-debts/${supplierId}/payments`, {
    headers: {
      "X-Midnight-Secret": checked.secret,
      "X-Midnight-User-Unit-Id": String(current.unitId),
      Cookie: checked.cookie,
    },
    cache: "no-store",
  });
  const json = await r.json().catch(() => ({}));
  return NextResponse.json(json, { status: r.status });
}

export async function POST(request, { params }) {
  const cookie = request.headers.get("cookie") || "";
  const denied = await midnightPermissionDenial(cookie, ["midnight.debts.write"]);
  if (denied) {
    return NextResponse.json(denied.body, { status: denied.status });
  }
  const checked = validateUnlocked(request);
  if (checked instanceof NextResponse) {
    return checked;
  }
  const { supplierId } = await params;
  const body = await request.json().catch(() => ({}));
  const base = getBackendBaseForMidnight();
  const current = await getCurrentUserUnitIdForMidnight(checked.cookie);
  if (current.error) {
    return NextResponse.json(current.error, { status: current.status });
  }
  const r = await fetch(`${base}/midnight-secret/partner-debts/${supplierId}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Midnight-Secret": checked.secret,
      "X-Midnight-User-Unit-Id": String(current.unitId),
      Cookie: checked.cookie,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await r.json().catch(() => ({}));
  return NextResponse.json(json, { status: r.status });
}
