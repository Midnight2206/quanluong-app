"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { useGetUsersQuery } from "@/features/users/api/usersApi";
import { chatThreadKey, parseChatThreadKey } from "@/features/chat/chatThreadKeys";
import { sameChatUserId } from "@/features/chat/chatUserIds";
import { connectChatSocket, disconnectChatSocket, getChatSocketInstance } from "@/features/chat/chatSocketClient";
import { apiRequest } from "@/services/apiRequest";
import { notifyChatIncoming, notifyError } from "@/services/notify";

const CHAT_PAGE_SIZE = 40;

/** @typedef {{ slots: [string | null, string | null], queue: string[] }} DockState */

/** @type {DockState} */
const initialDock = { slots: [null, null], queue: [] };

/** @param {DockState} state @param {{ type: string, threadKey?: string | null }} action */
function dockReducer(state, action) {
  const { slots, queue } = state;
  const [a, b] = slots;
  const k = action.threadKey;

  switch (action.type) {
    case "OPEN": {
      if (k == null) {
        return state;
      }
      if (k === a || k === b) {
        return state;
      }
      if (a == null) {
        return { ...state, slots: [k, b], queue: queue.filter((id) => id !== k) };
      }
      if (b == null) {
        return { ...state, slots: [a, k], queue: queue.filter((id) => id !== k) };
      }
      const bumped = a;
      const nextQueue = [bumped, ...queue.filter((id) => id !== k && id !== bumped)];
      return { slots: [b, k], queue: nextQueue };
    }
    case "CLOSE": {
      if (k == null) {
        return state;
      }
      let nextQueue = queue.filter((id) => id !== k);
      if (k !== a && k !== b) {
        return { ...state, queue: nextQueue };
      }
      let na = k === a ? null : a;
      let nb = k === b ? null : b;
      if (nextQueue.length > 0) {
        const promote = nextQueue[0];
        nextQueue = nextQueue.slice(1);
        if (k === a) {
          na = promote;
        } else {
          nb = promote;
        }
      }
      return { slots: [na, nb], queue: nextQueue };
    }
    case "MINIMIZE": {
      if (k == null) {
        return state;
      }
      if (k === a) {
        return {
          ...state,
          slots: [null, b],
          queue: [k, ...queue.filter((id) => id !== k)],
        };
      }
      if (k === b) {
        return {
          ...state,
          slots: [a, null],
          queue: [k, ...queue.filter((id) => id !== k)],
        };
      }
      return state;
    }
    case "PROMOTE": {
      if (k == null || !queue.includes(k)) {
        return state;
      }
      const rest = queue.filter((id) => id !== k);
      if (b == null && a != null) {
        return { ...state, slots: [a, k], queue: rest };
      }
      if (a == null) {
        return { ...state, slots: [k, b], queue: rest };
      }
      const bumped = a;
      return { slots: [k, b], queue: [bumped, ...rest] };
    }
    case "RESET":
      return initialDock;
    default:
      return state;
  }
}

/** @type {import("react").Context<null | object>} */
const ChatDockContext = createContext(null);

/** Gộp danh sách tin nhắn, bỏ trùng `id` (phòng ack + socket hoặc race loadHistory). */
function dedupeMessagesSorted(arr) {
  const byKey = new Map();
  for (const m of arr) {
    if (m == null || m.id == null) {
      continue;
    }
    const k = String(m.id);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, m);
      continue;
    }
    const tNew = new Date(m.createdAt).getTime();
    const tOld = new Date(prev.createdAt).getTime();
    if (Number.isFinite(tNew) && (!Number.isFinite(tOld) || tNew >= tOld)) {
      byKey.set(k, m);
    }
  }
  const out = [...byKey.values()];
  out.sort((x, y) => {
    const tx = new Date(x.createdAt).getTime();
    const ty = new Date(y.createdAt).getTime();
    return (Number.isFinite(tx) ? tx : 0) - (Number.isFinite(ty) ? ty : 0);
  });
  return out;
}

function peerLabelFromConv(conv) {
  if (!conv || conv.kind !== "direct") {
    return "";
  }
  return conv.peer?.profile?.fullName || conv.peer?.username || `#${conv.peerUserId}`;
}

export function ChatDockProvider({ children }) {
  const user = useCurrentUser();
  const [dock, dispatch] = useReducer(dockReducer, initialDock);
  /** @type {[Record<string, Array<object>>, function]} */
  const [messagesByThread, setMessagesByThread] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const [threadPaging, setThreadPaging] = useState({});
  const [loadingOlderThread, setLoadingOlderThread] = useState({});
  /** @type {Record<string, Set<number>>} */
  const [typingUsersByThread, setTypingUsersByThread] = useState({});
  const dockRef = useRef(dock);
  dockRef.current = dock;
  const userRef = useRef(user);
  userRef.current = user;
  const typingClearTimersRef = useRef({});
  const typingDebounceRef = useRef({});
  /** Tránh gửi trùng (double click / Enter + IME). */
  const sendDedupeRef = useRef({ key: "", at: 0 });
  /** Tránh append trùng khi ack socket.io gọi callback 2 lần. */
  const ackSeenRef = useRef(new Set());
  /** Tránh xử lý trùng cùng một sự kiện socket (listener đăng ký 2 lần). */
  const socketEventSeenRef = useRef(new Set());
  /** Map userId → user row (tên/avatar khi toast, khi conv chưa kịp có trong danh sách). */
  const userByIdRef = useRef(new Map());

  const { data: chatUsers = [] } = useGetUsersQuery(undefined, { skip: !user?.id });

  useEffect(() => {
    const m = new Map();
    for (const u of chatUsers) {
      const id = Number(u.id);
      if (Number.isFinite(id)) {
        m.set(id, u);
      }
    }
    userByIdRef.current = m;
  }, [chatUsers]);

  const unreadChatTotal = useMemo(
    () => conversations.reduce((s, c) => s + (Number(c.unreadCount) || 0), 0),
    [conversations],
  );

  const refetchConversations = useCallback(async () => {
    if (!user?.id) {
      setConversations([]);
      return;
    }
    try {
      const rows = await apiRequest({ url: "/chat/conversations", method: "get" });
      setConversations(Array.isArray(rows) ? rows : []);
    } catch {
      notifyError("Không tải được danh sách hội thoại");
    }
  }, [user?.id]);

  const prevSlotsRef = useRef(initialDock.slots);

  useEffect(() => {
    if (!user?.id) {
      dispatch({ type: "RESET" });
      prevSlotsRef.current = initialDock.slots;
      setPickerOpen(false);
      setGroupModalOpen(false);
      setHubOpen(false);
      setConversations([]);
      setThreadPaging({});
      setLoadingOlderThread({});
      setTypingUsersByThread({});
    }
  }, [user?.id]);

  useEffect(() => {
    if (hubOpen && user?.id) {
      void refetchConversations();
    }
  }, [hubOpen, user?.id, refetchConversations]);

  const loadHistory = useCallback(async (threadKey) => {
    const parsed = parseChatThreadKey(threadKey);
    if (!parsed) {
      return;
    }
    try {
      const url =
        parsed.type === "direct"
          ? `/chat/messages/${parsed.id}`
          : `/chat/groups/${parsed.id}/messages`;
      const rows = await apiRequest({
        url,
        method: "get",
        params: { limit: CHAT_PAGE_SIZE },
      });
      const list = dedupeMessagesSorted(Array.isArray(rows) ? rows : []);
      setMessagesByThread((prev) => ({ ...prev, [threadKey]: list }));
      setThreadPaging((p) => ({
        ...p,
        [threadKey]: { hasMoreOlder: list.length >= CHAT_PAGE_SIZE },
      }));
    } catch {
      notifyError("Không tải được lịch sử chat");
    }
  }, []);

  const loadOlderMessages = useCallback(
    async (threadKey) => {
      const parsed = parseChatThreadKey(threadKey);
      if (!parsed) {
        return;
      }
      const list = messagesByThread[threadKey] ?? [];
      const oldest = list[0];
      const paging = threadPaging[threadKey];
      if (!oldest?.id || loadingOlderThread[threadKey] || !paging?.hasMoreOlder) {
        return;
      }
      setLoadingOlderThread((x) => ({ ...x, [threadKey]: true }));
      try {
        const url =
          parsed.type === "direct"
            ? `/chat/messages/${parsed.id}`
            : `/chat/groups/${parsed.id}/messages`;
        const rows = await apiRequest({
          url,
          method: "get",
          params: { limit: CHAT_PAGE_SIZE, before: oldest.id },
        });
        const older = Array.isArray(rows) ? rows : [];
        setMessagesByThread((prev) => {
          const cur = [...(prev[threadKey] ?? [])];
          const seen = new Set(cur.map((m) => String(m.id)));
          for (const m of older) {
            if (!seen.has(String(m.id))) {
              seen.add(String(m.id));
              cur.unshift(m);
            }
          }
          return { ...prev, [threadKey]: dedupeMessagesSorted(cur) };
        });
        setThreadPaging((p) => ({
          ...p,
          [threadKey]: { hasMoreOlder: older.length >= CHAT_PAGE_SIZE },
        }));
      } catch {
        notifyError("Không tải thêm tin nhắn");
      } finally {
        setLoadingOlderThread((x) => ({ ...x, [threadKey]: false }));
      }
    },
    [messagesByThread, threadPaging, loadingOlderThread],
  );

  const bumpTypingUser = useCallback((threadKey, uid) => {
    if (uid == null || sameChatUserId(uid, user?.id)) {
      return;
    }
    setTypingUsersByThread((prev) => {
      const next = { ...prev };
      const set = new Set(next[threadKey] ?? []);
      set.add(uid);
      next[threadKey] = set;
      return next;
    });
    const map = typingClearTimersRef.current;
    const tid = `${threadKey}:${uid}`;
    if (map[tid]) {
      clearTimeout(map[tid]);
    }
    map[tid] = setTimeout(() => {
      setTypingUsersByThread((prev) => {
        const next = { ...prev };
        const set = new Set(next[threadKey] ?? []);
        set.delete(uid);
        if (set.size === 0) {
          delete next[threadKey];
        } else {
          next[threadKey] = set;
        }
        return next;
      });
      delete map[tid];
    }, 3500);
  }, [user?.id]);

  const refetchConversationsRef = useRef(refetchConversations);
  refetchConversationsRef.current = refetchConversations;
  const bumpTypingUserRef = useRef(bumpTypingUser);
  bumpTypingUserRef.current = bumpTypingUser;

  const emitTypingDebounced = useCallback(
    (threadKey) => {
      const s = getChatSocketInstance();
      if (!s?.connected) {
        return;
      }
      const parsed = parseChatThreadKey(threadKey);
      if (!parsed) {
        return;
      }
      const key = threadKey;
      if (typingDebounceRef.current[key]) {
        clearTimeout(typingDebounceRef.current[key]);
      }
      typingDebounceRef.current[key] = setTimeout(() => {
        delete typingDebounceRef.current[key];
        if (parsed.type === "direct") {
          s.emit("chat:typing", { peerUserId: parsed.id });
        } else {
          s.emit("group:typing", { groupId: parsed.id });
        }
      }, 450);
    },
    [],
  );

  const markThreadRead = useCallback(async (threadKey) => {
    const parsed = parseChatThreadKey(threadKey);
    if (!parsed) {
      return;
    }
    try {
      if (parsed.type === "direct") {
        await apiRequest({ url: "/chat/direct/read", method: "post", data: { peerUserId: parsed.id } });
      } else {
        await apiRequest({ url: `/chat/groups/${parsed.id}/read`, method: "post" });
      }
      void refetchConversations();
    } catch {
      /* ignore mark read failures */
    }
  }, [refetchConversations]);

  useLayoutEffect(() => {
    if (!user?.id) {
      return;
    }
    const [pa, pb] = prevSlotsRef.current;
    const [na, nb] = dock.slots;
    prevSlotsRef.current = dock.slots;
    const prevKeys = new Set([pa, pb].filter(Boolean));
    for (const nk of [na, nb].filter(Boolean)) {
      if (!prevKeys.has(nk)) {
        void loadHistory(nk);
        void markThreadRead(nk);
      }
    }
  }, [user?.id, dock.slots, loadHistory, markThreadRead]);

  useEffect(() => {
    if (!user?.id) {
      disconnectChatSocket();
      setMessagesByThread({});
      socketEventSeenRef.current = new Set();
      ackSeenRef.current = new Set();
      return;
    }

    const s = connectChatSocket();
    if (!s) {
      return;
    }

    function onChatMessage(msg) {
      if (msg?.kind === "group") {
        return;
      }
      const peerId = msg.peerUserId;
      if (peerId == null || !Number.isFinite(Number(peerId)) || msg.id == null) {
        return;
      }
      const pid = Number(peerId);
      const key = chatThreadKey("direct", pid);
      const uid = userRef.current?.id;
      const evKey = `d:${key}:${msg.id}`;
      if (socketEventSeenRef.current.has(evKey)) {
        return;
      }
      socketEventSeenRef.current.add(evKey);
      if (socketEventSeenRef.current.size > 2000) {
        socketEventSeenRef.current = new Set();
      }

      if (sameChatUserId(msg.senderId, uid)) {
        return;
      }
      const tempId = msg.tempId != null ? String(msg.tempId) : null;
      setMessagesByThread((prev) => {
        let arr = [...(prev[key] ?? [])];
        if (tempId) {
          arr = arr.filter((m) => String(m.id) !== tempId);
        }
        arr.push({
          id: msg.id,
          senderId: msg.senderId,
          recipientId: msg.recipientId,
          body: msg.body,
          createdAt: msg.createdAt,
        });
        return { ...prev, [key]: dedupeMessagesSorted(arr) };
      });
      if (!sameChatUserId(msg.senderId, uid) && msg.body) {
        const [sa, sb] = dockRef.current.slots;
        const threadOpen = sa === key || sb === key;
        if (!threadOpen) {
          const conv = conversationsRef.current.find(
            (c) => c.kind === "direct" && sameChatUserId(c.peerUserId, msg.senderId),
          );
          const sid = Number(msg.senderId);
          const row = Number.isFinite(sid) ? userByIdRef.current.get(sid) : undefined;
          const label =
            peerLabelFromConv(conv) ||
            row?.profile?.fullName ||
            row?.username ||
            `Người #${msg.senderId}`;
          const avatarUrl = conv?.peer?.profile?.avatarUrl ?? row?.profile?.avatarUrl ?? null;
          notifyChatIncoming(label, {
            description: String(msg.body).slice(0, 200),
            avatarUrl,
            isGroup: false,
          });
        }
      }
      void refetchConversationsRef.current();
    }

    function onGroupMessage(msg) {
      if (msg?.kind !== "group" || msg.groupId == null || msg.id == null) {
        return;
      }
      const gid = Number(msg.groupId);
      const key = chatThreadKey("group", gid);
      const uid = userRef.current?.id;
      const evKey = `g:${key}:${msg.id}`;
      if (socketEventSeenRef.current.has(evKey)) {
        return;
      }
      socketEventSeenRef.current.add(evKey);
      if (socketEventSeenRef.current.size > 2000) {
        socketEventSeenRef.current = new Set();
      }

      if (sameChatUserId(msg.senderId, uid)) {
        return;
      }
      const tempId = msg.tempId != null ? String(msg.tempId) : null;
      setMessagesByThread((prev) => {
        let arr = [...(prev[key] ?? [])];
        if (tempId) {
          arr = arr.filter((m) => String(m.id) !== tempId);
        }
        arr.push({
          id: msg.id,
          groupId: msg.groupId,
          senderId: msg.senderId,
          body: msg.body,
          createdAt: msg.createdAt,
        });
        return { ...prev, [key]: dedupeMessagesSorted(arr) };
      });
      if (!sameChatUserId(msg.senderId, uid) && msg.body) {
        const [sa, sb] = dockRef.current.slots;
        const threadOpen = sa === key || sb === key;
        if (!threadOpen) {
          const conv = conversationsRef.current.find((c) => c.kind === "group" && Number(c.groupId) === gid);
          const title = conv?.name || `Nhóm #${gid}`;
          const sid = Number(msg.senderId);
          const sender = Number.isFinite(sid) ? userByIdRef.current.get(sid) : undefined;
          const senderLine = sender?.profile?.fullName || sender?.username || `Người #${msg.senderId}`;
          notifyChatIncoming(title, {
            description: String(msg.body).slice(0, 200),
            isGroup: true,
            subtitle: senderLine,
          });
        }
      }
      void refetchConversationsRef.current();
    }

    function onChatTyping(payload) {
      const from = Number(payload?.fromUserId);
      const uid = userRef.current?.id;
      if (!Number.isFinite(from) || sameChatUserId(from, uid)) {
        return;
      }
      const key = chatThreadKey("direct", from);
      bumpTypingUserRef.current(key, from);
    }

    function onGroupTyping(payload) {
      const gid = Number(payload?.groupId);
      const from = Number(payload?.fromUserId);
      const uid = userRef.current?.id;
      if (!Number.isFinite(gid) || !Number.isFinite(from) || sameChatUserId(from, uid)) {
        return;
      }
      const key = chatThreadKey("group", gid);
      bumpTypingUserRef.current(key, from);
    }

    s.on("chat:message", onChatMessage);
    s.on("chat:group:message", onGroupMessage);
    s.on("chat:typing", onChatTyping);
    s.on("group:typing", onGroupTyping);
    return () => {
      s.off("chat:message", onChatMessage);
      s.off("chat:group:message", onGroupMessage);
      s.off("chat:typing", onChatTyping);
      s.off("group:typing", onGroupTyping);
    };
  }, [user?.id]);

  const openThread = useCallback(
    (threadKey) => {
      if (!user?.id || threadKey == null) {
        return;
      }
      const parsed = parseChatThreadKey(threadKey);
      if (parsed?.type === "direct" && parsed.id === user.id) {
        return;
      }
      dispatch({ type: "OPEN", threadKey });
    },
    [user?.id],
  );

  const openDirectChat = useCallback(
    (peerId) => {
      if (!user?.id || peerId === user.id) {
        return;
      }
      openThread(chatThreadKey("direct", peerId));
    },
    [user?.id, openThread],
  );

  const openGroupChat = useCallback(
    (groupId) => {
      openThread(chatThreadKey("group", groupId));
    },
    [openThread],
  );

  const closeChat = useCallback((threadKey) => {
    dispatch({ type: "CLOSE", threadKey });
  }, []);

  const minimizeChat = useCallback((threadKey) => {
    dispatch({ type: "MINIMIZE", threadKey });
  }, []);

  const promoteFromQueue = useCallback((threadKey) => {
    dispatch({ type: "PROMOTE", threadKey });
  }, []);

  const subscribeGroupSocket = useCallback((groupId) => {
    const s = getChatSocketInstance();
    if (!s?.connected) {
      return;
    }
    s.emit("group:subscribe", { groupId }, () => {});
  }, []);

  const appendOutgoingMessage = useCallback((threadKey, m) => {
    setMessagesByThread((prev) => ({
      ...prev,
      [threadKey]: dedupeMessagesSorted([...(prev[threadKey] ?? []), m]),
    }));
  }, []);

  const sendText = useCallback(
    (threadKey, text) => {
      const s = getChatSocketInstance();
      if (!s?.connected) {
        notifyError("Chưa kết nối chat — thử tải lại trang.");
        return;
      }
      const parsed = parseChatThreadKey(threadKey);
      if (!parsed) {
        return;
      }
      const trimmed = String(text ?? "").trim();
      if (!trimmed) {
        return;
      }

      const now = Date.now();
      const dedupeKey = `${threadKey}::${trimmed}`;
      const { key: prevKey, at: prevAt } = sendDedupeRef.current;
      if (prevKey === dedupeKey && now - prevAt < 900) {
        return;
      }
      sendDedupeRef.current = { key: dedupeKey, at: now };

      const applyAck = (m) => {
        if (m?.id == null) {
          return;
        }
        const ackKey = `${threadKey}:${m.id}`;
        if (ackSeenRef.current.has(ackKey)) {
          return;
        }
        ackSeenRef.current.add(ackKey);
        if (ackSeenRef.current.size > 600) {
          ackSeenRef.current = new Set();
        }
        appendOutgoingMessage(threadKey, m);
      };

      if (parsed.type === "direct") {
        const peerId = parsed.id;
        s.emit("chat:send", { peerUserId: peerId, text: trimmed }, (ack) => {
          if (ack && ack.ok === false) {
            notifyError(ack.error || "Gửi tin nhắn thất bại");
            return;
          }
          const m = ack?.message;
          if (m?.id != null) {
            applyAck({
              id: m.id,
              senderId: m.senderId,
              recipientId: m.recipientId,
              body: m.body,
              createdAt: m.createdAt,
            });
          }
        });
        return;
      }

      const groupId = parsed.id;
      s.emit("group:send", { groupId, text: trimmed }, (ack) => {
        if (ack && ack.ok === false) {
          notifyError(ack.error || "Gửi tin nhắn thất bại");
          return;
        }
        const m = ack?.message;
        if (m?.id != null) {
          applyAck({
            id: m.id,
            groupId: m.groupId,
            senderId: m.senderId,
            body: m.body,
            createdAt: m.createdAt,
          });
        }
      });
    },
    [appendOutgoingMessage],
  );

  const createGroup = useCallback(
    async ({ name, memberUserIds }) => {
      try {
        const data = await apiRequest({
          url: "/chat/groups",
          method: "post",
          data: { name, memberUserIds },
        });
        if (data?.id != null) {
          subscribeGroupSocket(Number(data.id));
          await refetchConversations();
          openGroupChat(Number(data.id));
        }
        return data;
      } catch (err) {
        const msg =
          err?.data?.message ||
          (typeof err?.data === "object" && err?.data?.error) ||
          "Không tạo được nhóm";
        notifyError(typeof msg === "string" ? msg : "Không tạo được nhóm");
        throw err;
      }
    },
    [openGroupChat, refetchConversations, subscribeGroupSocket],
  );

  const value = useMemo(
    () => ({
      dock,
      messagesByThread,
      pickerOpen,
      setPickerOpen,
      groupModalOpen,
      setGroupModalOpen,
      hubOpen,
      setHubOpen,
      toggleHub: () => setHubOpen((v) => !v),
      conversations,
      refetchConversations,
      unreadChatTotal,
      threadPaging,
      loadingOlderThread,
      loadOlderMessages,
      typingUsersByThread,
      emitTypingDebounced,
      openThread,
      openDirectChat,
      openGroupChat,
      closeChat,
      minimizeChat,
      promoteFromQueue,
      sendText,
      loadHistory,
      createGroup,
      subscribeGroupSocket,
    }),
    [
      dock,
      messagesByThread,
      pickerOpen,
      groupModalOpen,
      hubOpen,
      conversations,
      refetchConversations,
      unreadChatTotal,
      threadPaging,
      loadingOlderThread,
      loadOlderMessages,
      typingUsersByThread,
      emitTypingDebounced,
      openThread,
      openDirectChat,
      openGroupChat,
      closeChat,
      minimizeChat,
      promoteFromQueue,
      sendText,
      loadHistory,
      createGroup,
      subscribeGroupSocket,
    ],
  );

  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>;
}

export function useChatDock() {
  const ctx = useContext(ChatDockContext);
  if (!ctx) {
    throw new Error("useChatDock must be used within ChatDockProvider");
  }
  return ctx;
}

export function useChatDockOptional() {
  return useContext(ChatDockContext);
}
