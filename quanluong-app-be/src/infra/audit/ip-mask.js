const FULL_IP_DAYS = 90;

function maskIp(ip) {
  if (!ip) return ip ?? null;
  const v4 = ip.replace(/^::ffff:/i, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) {
    const [a, b] = v4.split(".");
    return `${a}.${b}.x.x`;
  }
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean).slice(0, 3);
    return `${parts.join(":")}::x`;
  }
  return "x";
}

/** IP đầy đủ khi sự kiện < 90 ngày, che bớt khi cũ hơn. */
function displayIp(ip, occurredAt, now = new Date()) {
  if (!ip) return null;
  const ageMs = now.getTime() - new Date(occurredAt).getTime();
  return ageMs < FULL_IP_DAYS * 86400000 ? ip : maskIp(ip);
}

export { displayIp, FULL_IP_DAYS, maskIp };
