import { io } from "socket.io-client";
import { getChatSocketBaseUrl } from "@/utils/runtimeEnv";

/** @type {import("socket.io-client").Socket | null} */
let socket = null;

/**
 * Kết nối Socket.io (cookie httpOnly gửi kèm `withCredentials`).
 * @returns {import("socket.io-client").Socket | null}
 */
export function connectChatSocket() {
  const url = getChatSocketBaseUrl();
  if (!url) {
    return null;
  }
  /** Không disconnect socket đang chờ `connect` — tránh tạo 2 socket / đăng ký listener trùng. */
  if (socket) {
    return socket;
  }
  socket = io(url, {
    path: "/socket.io",
    withCredentials: true,
    transports: ["websocket", "polling"],
    autoConnect: true,
  });
  return socket;
}

/** @returns {import("socket.io-client").Socket | null} */
export function getChatSocketInstance() {
  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
  }
}
