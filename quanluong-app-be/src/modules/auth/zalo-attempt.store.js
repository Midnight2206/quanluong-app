// Phiếu chỉ sống trong một process `app`; nhiều replica thì chuyển Map sang Redis.
const attempts = new Map();
const ATTEMPT_TTL_MS = 10 * 60 * 1000;

function putAttempt(attempt) {
  const stored = { ...attempt, expiresAt: Date.now() + ATTEMPT_TTL_MS };
  attempts.set(stored.ticket, stored);
  return stored;
}

function getAttempt(ticket) {
  const attempt = attempts.get(ticket);
  if (!attempt || attempt.expiresAt <= Date.now()) {
    if (attempt) attempts.delete(ticket);
    return null;
  }
  return attempt;
}

function patchAttempt(ticket, patch) {
  const attempt = getAttempt(ticket);
  if (!attempt) return null;
  Object.assign(attempt, patch);
  return attempt;
}

export { getAttempt, patchAttempt, putAttempt };
