const SESSION_EVENT = "app:logout";
const SESSION_STORAGE_KEY = "app:session-event";
const LOGOUT_MARKER = "logout";

const notifyLogout = () => {
  window.dispatchEvent(new Event(SESSION_EVENT));

  try {
    localStorage.setItem(SESSION_STORAGE_KEY, LOGOUT_MARKER);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures so logout still completes.
  }
};

export const session = {
  logout: () => {
    localStorage.removeItem("auth:user");
    localStorage.removeItem("auth:access");
    notifyLogout();
    window.location.href = "/login";
  },

  onLogout: (callback) => {
    const handleStorage = (event) => {
      if (
        event.key === SESSION_STORAGE_KEY &&
        event.newValue === LOGOUT_MARKER
      ) {
        callback(event);
      }
    };

    window.addEventListener(SESSION_EVENT, callback);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(SESSION_EVENT, callback);
      window.removeEventListener("storage", handleStorage);
    };
  },
};
