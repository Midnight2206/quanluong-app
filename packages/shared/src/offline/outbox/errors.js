export function isAuthExpired(err) {
  return err?.status === 401;
}

export function isForbidden(err) {
  return err?.status === 403;
}

export function isClientError(err) {
  const status = err?.status;
  if (!(status >= 400 && status < 500)) return false;
  if (status === 401 || status === 403) return false;
  return true;
}
