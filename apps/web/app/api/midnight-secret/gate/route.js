import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  getCurrentUserUnitIdForMidnight,
  getMidnightGateCookieValue,
  MIDNIGHT_GATE_COOKIE,
  MIDNIGHT_GATE_MAX_AGE_SECONDS,
} from "../../../../lib/midnightSecretServer.js";

export async function POST(request) {
  if (!process.env.MIDNIGHT_SECRET_PASSWORD || String(process.env.MIDNIGHT_SECRET_PASSWORD).trim() === "") {
    return NextResponse.json(
      { success: false, error: { message: "Chưa cấu hình MIDNIGHT_SECRET_PASSWORD (server web)" } },
      { status: 503 },
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: { message: "Body không hợp lệ" } }, { status: 400 });
  }
  const pwd = String(body?.password ?? "");
  const exp = process.env.MIDNIGHT_SECRET_PASSWORD;
  const a = Buffer.from(pwd, "utf8");
  const b = Buffer.from(exp, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ success: false, error: { message: "Mật khẩu không đúng" } }, { status: 401 });
  }
  const cookie = request.headers.get("cookie") || "";
  const current = await getCurrentUserUnitIdForMidnight(cookie);
  if (current.error) {
    return NextResponse.json(
      { success: false, error: { message: "Bạn cần đăng nhập trước khi mở trang nội bộ" } },
      { status: current.status || 401 },
    );
  }
  const token = getMidnightGateCookieValue(cookie);
  if (!token) {
    return NextResponse.json({ success: false, error: { message: "Lỗi tạo phiên" } }, { status: 500 });
  }
  const res = NextResponse.json({ success: true, data: { ok: true } });
  res.cookies.set(MIDNIGHT_GATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MIDNIGHT_GATE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
