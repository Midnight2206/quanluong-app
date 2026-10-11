function normalizeVnPhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  let national = digits;
  if (national.startsWith("84")) {
    national = national.slice(2);
  } else if (national.startsWith("0")) {
    national = national.slice(1);
  }
  if (!/^([35789]\d{8}|2\d{9})$/.test(national)) {
    return null;
  }
  return `84${national}`;
}

export { normalizeVnPhone };
