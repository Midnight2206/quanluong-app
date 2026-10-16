import { NextResponse } from "next/server";
import {
  getBackendBaseForMidnight,
  getMidnightSecretHeader,
  isMidnightGateCookieValid,
  midnightPermissionDenial,
  MIDNIGHT_GATE_COOKIE,
  resolveMidnightProxyUnitId,
} from "./midnightSecretServer.js";

/**
 * Chuẩn bị gọi backend báo cáo nội bộ qua BFF.
 * @param {{ cookie: string, permissionCodes: string[], preferredUnitId?: string|number|null, requireUnit?: boolean }} args
 */
export async function prepareMidnightProxy({
  cookie,
  permissionCodes,
  preferredUnitId = null,
  requireUnit = true,
}) {
  const denied = await midnightPermissionDenial(cookie, permissionCodes);
  if (denied) {
    return { errorResponse: NextResponse.json(denied.body, { status: denied.status }) };
  }
  // Gate cookie đọc từ raw Cookie header qua helper riêng ở caller (request.cookies).
  const secret = getMidnightSecretHeader();
  if (!secret) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: { message: "Chưa cấu hình MIDNIGHT_SECRET_PASSWORD" } },
        { status: 503 },
      ),
    };
  }
  const current = await resolveMidnightProxyUnitId(cookie, preferredUnitId);
  if (current.error) {
    return { errorResponse: NextResponse.json(current.error, { status: current.status }) };
  }
  if (requireUnit && !(Number.isInteger(current.unitId) && current.unitId > 0)) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: { message: "Chọn đơn vị kho trước khi xem báo cáo." } },
        { status: 400 },
      ),
    };
  }
  const headers = {
    "X-Midnight-Secret": secret,
    Cookie: cookie,
  };
  if (Number.isInteger(current.unitId) && current.unitId > 0) {
    headers["X-Midnight-User-Unit-Id"] = String(current.unitId);
  }
  return {
    base: getBackendBaseForMidnight(),
    headers,
    unitId: current.unitId,
  };
}

export function assertMidnightGate(request, cookie) {
  const c = request.cookies.get(MIDNIGHT_GATE_COOKIE);
  if (!isMidnightGateCookieValid(c?.value, cookie)) {
    return NextResponse.json(
      { success: false, error: { message: "Chưa mở khóa trang" } },
      { status: 401 },
    );
  }
  return null;
}
