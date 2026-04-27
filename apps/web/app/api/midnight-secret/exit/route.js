import { NextResponse } from "next/server";
import { MIDNIGHT_GATE_COOKIE } from "../../../../lib/midnightSecretServer.js";

export async function POST() {
  const res = NextResponse.json({ success: true, data: { ok: true } });
  res.cookies.set(MIDNIGHT_GATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
