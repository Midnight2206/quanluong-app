export async function verifySessionOrRefresh({
  apiRequest,
  setAuthState,
  mapPermissionsFromUser,
} = {}) {
  async function tryCurrentUser() {
    return apiRequest({ url: "/auth/current-user", method: "get" });
  }

  let user;
  try {
    user = await tryCurrentUser();
  } catch (err) {
    if (err?.status !== 401) {
      return { ok: false, reason: "AUTH_EXPIRED" };
    }
    try {
      await apiRequest({ url: "/auth/refresh-token", method: "post", data: {} });
      user = await tryCurrentUser();
    } catch {
      return { ok: false, reason: "AUTH_EXPIRED" };
    }
  }

  if (user == null) {
    return { ok: false, reason: "AUTH_EXPIRED" };
  }

  if (typeof setAuthState === "function") {
    const permissions =
      typeof mapPermissionsFromUser === "function"
        ? mapPermissionsFromUser(user)
        : undefined;
    setAuthState(permissions != null ? { user, permissions } : { user });
  }

  return { ok: true, user };
}
