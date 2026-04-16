/** So sánh id user từ API/Zustand (number|string) với id từ socket/Prisma. */
export function sameChatUserId(a, b) {
  if (a == null || b == null) {
    return false;
  }
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    return na === nb;
  }
  return String(a) === String(b);
}
