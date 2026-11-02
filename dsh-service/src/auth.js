import { timingSafeEqual } from "node:crypto";

export function bearerOk(header, expected) {
  if (!expected) return false;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(String(header || ""));
  if (!match) return false;
  const got = Buffer.from(match[1]);
  const want = Buffer.from(expected);
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}
