"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  MessageCircle,
  Minus,
  PenSquare,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { useChatDock } from "@/contexts/ChatDockContext";
import { useGetUsersQuery } from "@/features/users/api/usersApi";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { chatThreadKey, parseChatThreadKey } from "@/features/chat/chatThreadKeys";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { sameChatUserId } from "@/features/chat/chatUserIds";
import { resolveAvatarUrl } from "@/utils/avatarUrl";
import { resolveMediaUrl } from "@/utils/runtimeEnv";

const WINDOW_W = "w-[min(100vw-2rem,22rem)] sm:w-[22rem]";
const WINDOW_H = "h-[min(22rem,calc(100dvh-8rem))] sm:h-[26rem]";

function peerLabel(userRow) {
  return userRow?.profile?.fullName || userRow?.username || `#${userRow?.id}`;
}

function peerAvatarUrl(userRow) {
  return resolveAvatarUrl(userRow?.profile?.avatarUrl);
}

function formatMessageTime(iso) {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const pad = (n) => String(n).padStart(2, "0");
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDay) {
    return hm;
  }
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hm}`;
}

function ChatUserPicker({ open, onClose, onPick }) {
  const { data: users = [], isLoading } = useGetUsersQuery(undefined, { skip: !open });
  const me = useCurrentUser();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      if (u.id === me?.id) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const name = peerLabel(u).toLowerCase();
      const un = (u.username || "").toLowerCase();
      return name.includes(needle) || un.includes(needle);
    });
  }, [users, me?.id, q]);

  useEffect(() => {
    if (!open) {
      setQ("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-start justify-center bg-black/40 p-4 pt-24 backdrop-blur-[2px] sm:pt-28"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[min(70dvh,32rem)] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-float"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        aria-modal="true"
        aria-labelledby="chat-picker-title"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="chat-picker-title" className="text-sm font-semibold">
            Tin nhắn mới
          </h2>
          <button
            type="button"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="border-b border-border px-3 py-2">
          <input
            type="search"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="Tìm theo tên hoặc username…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>
        <ul
          data-local-scroll="true"
          className="max-h-[min(50dvh,24rem)] overflow-y-auto p-2"
        >
          {isLoading ? (
            <li className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Không có người dùng phù hợp.</li>
          ) : (
            filtered.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-muted"
                  onClick={() => {
                    onPick(u.id);
                    onClose();
                  }}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                    <img src={peerAvatarUrl(u)} alt="" className="size-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{peerLabel(u)}</p>
                    <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function GroupCreateModal({ open, onClose, onCreate }) {
  const me = useCurrentUser();
  const { data: users = [], isLoading } = useGetUsersQuery(undefined, { skip: !open });
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setQ("");
      setSelected(new Set());
      setSaving(false);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      if (u.id === me?.id) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const label = peerLabel(u).toLowerCase();
      const un = (u.username || "").toLowerCase();
      return label.includes(needle) || un.includes(needle);
    });
  }, [users, me?.id, q]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const n = name.trim();
    if (!n || selected.size < 1) {
      return;
    }
    setSaving(true);
    try {
      await onCreate({ name: n, memberUserIds: [...selected] });
      onClose();
    } catch {
      /* notify in parent */
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-start justify-center bg-black/40 p-4 pt-20 backdrop-blur-[2px] sm:pt-24"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(75dvh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-float"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        aria-modal="true"
        aria-labelledby="group-create-title"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="group-create-title" className="text-sm font-semibold">
            Nhóm mới
          </h2>
          <button
            type="button"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-2 border-b border-border px-4 py-3">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="group-name">
            Tên nhóm
          </label>
          <input
            id="group-name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="Ví dụ: Nhóm dự án A"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="border-b border-border px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
              placeholder="Tìm thành viên…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <ul
          data-local-scroll="true"
          className="min-h-0 flex-1 overflow-y-auto p-2"
        >
          {isLoading ? (
            <li className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </li>
          ) : (
            filtered.map((u) => (
              <li key={u.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggle(u.id)}
                    className="size-4 rounded border-border"
                  />
                  <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                    <img src={peerAvatarUrl(u)} alt="" className="size-full object-cover" />
                  </div>
                  <span className="min-w-0 truncate font-medium">{peerLabel(u)}</span>
                </label>
              </li>
            ))
          )}
        </ul>
        <div className="flex gap-2 border-t border-border p-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={saving || !name.trim() || selected.size < 1}
            onClick={() => void handleSubmit()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Tạo nhóm"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChatHubPanel({
  open,
  onClose,
  conversations,
  tab,
  onTab,
  search,
  onSearch,
  onPickDirect,
  onPickGroup,
  onNewDm,
  onNewGroup,
}) {
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let rows = conversations;
    if (tab === "read") {
      rows = rows.filter((c) => (c.unreadCount ?? 0) === 0);
    } else if (tab === "unread") {
      rows = rows.filter((c) => (c.unreadCount ?? 0) > 0);
    }
    if (!needle) {
      return rows;
    }
    return rows.filter((c) => {
      if (c.kind === "direct") {
        const name = (c.peer?.profile?.fullName || "").toLowerCase();
        const un = (c.peer?.username || "").toLowerCase();
        const last = (c.lastMessage?.body || "").toLowerCase();
        return name.includes(needle) || un.includes(needle) || last.includes(needle);
      }
      const gn = (c.name || "").toLowerCase();
      const last = (c.lastMessage?.body || "").toLowerCase();
      return gn.includes(needle) || last.includes(needle);
    });
  }, [conversations, tab, search]);

  if (!open) {
    return null;
  }

  const tabs = [
    { id: "all", label: "Tất cả" },
    { id: "read", label: "Đã đọc" },
    { id: "unread", label: "Chưa đọc" },
  ];

  return (
    <div
      className="fixed inset-0 z-[205] bg-black/20 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-none"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="absolute right-3 top-[4.25rem] flex max-h-[calc(100dvh-5.5rem)] w-[min(calc(100vw-1.5rem),22rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-float sm:right-5 sm:top-[4.5rem] sm:w-[22rem]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-hub-title"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <h2 id="chat-hub-title" className="text-sm font-semibold">
            Tin nhắn
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Nhóm mới"
              aria-label="Nhóm mới"
              onClick={onNewGroup}
            >
              <Users className="size-4" />
            </button>
            <button
              type="button"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Chat mới"
              aria-label="Chat mới"
              onClick={onNewDm}
            >
              <PenSquare className="size-4" />
            </button>
            <button
              type="button"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onClose}
              aria-label="Đóng"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-0 border-b border-border px-2 pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                "flex-1 border-b-2 pb-2 text-center text-xs font-medium transition",
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="border-b border-border px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:border-primary"
              placeholder="Tìm người hoặc nhóm…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        </div>
        <ul data-local-scroll="true" className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">Không có hội thoại.</li>
          ) : (
            filtered.map((c) => {
              const unread = (c.unreadCount ?? 0) > 0;
              const last = c.lastMessage;
              const preview = last?.body || (c.kind === "group" ? "Chưa có tin nhắn" : "");
              const time = last?.createdAt ? formatMessageTime(last.createdAt) : "";
              if (c.kind === "direct") {
                const avatar = resolveAvatarUrl(c.peer?.profile?.avatarUrl);
                const title = c.peer?.profile?.fullName || c.peer?.username || `#${c.peerUserId}`;
                return (
                  <li key={`d-${c.peerUserId}`}>
                    <button
                      type="button"
                      className="flex w-full gap-3 border-b border-border/60 px-3 py-3 text-left transition hover:bg-muted/80"
                      onClick={() => onPickDirect(c.peerUserId)}
                    >
                      <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                        <img src={avatar} alt="" className="size-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={cn("truncate text-sm", unread ? "font-bold" : "font-medium")}>{title}</p>
                          {time ? (
                            <span className="shrink-0 text-[10px] text-muted-foreground">{time}</span>
                          ) : null}
                        </div>
                        <p className={cn("truncate text-xs text-muted-foreground", unread && "font-semibold text-foreground/80")}>
                          {preview}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              }
              return (
                <li key={`g-${c.groupId}`}>
                  <button
                    type="button"
                    className="flex w-full gap-3 border-b border-border/60 px-3 py-3 text-left transition hover:bg-muted/80"
                    onClick={() => onPickGroup(c.groupId)}
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      {(c.name || "N").trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn("truncate text-sm", unread ? "font-bold" : "font-medium")}>{c.name}</p>
                        {time ? (
                          <span className="shrink-0 text-[10px] text-muted-foreground">{time}</span>
                        ) : null}
                      </div>
                      <p className={cn("truncate text-xs text-muted-foreground", unread && "font-semibold text-foreground/80")}>
                        {preview}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

function ChatWindowFrame({
  threadKey,
  title,
  avatarUrl,
  isGroup,
  messages,
  onClose,
  onMinimize,
  onSend,
  hasMoreOlder,
  loadingOlder,
  onLoadOlder,
  typingUserIds,
  onTypingInput,
}) {
  const me = useCurrentUser();
  const scrollRef = useRef(null);
  const prevTailIdRef = useRef(null);
  const [draft, setDraft] = useState("");

  const list = messages ?? [];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || list.length === 0) {
      return;
    }
    const tailId = list[list.length - 1]?.id;
    if (prevTailIdRef.current !== tailId) {
      prevTailIdRef.current = tailId;
      el.scrollTop = el.scrollHeight;
    }
  }, [list, threadKey]);

  useEffect(() => {
    prevTailIdRef.current = null;
  }, [threadKey]);

  const fetchingOlderRef = useRef(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasMoreOlder || loadingOlder || !onLoadOlder || fetchingOlderRef.current) {
      return;
    }
    if (el.scrollTop < 72) {
      fetchingOlderRef.current = true;
      const prevScrollHeight = el.scrollHeight;
      const prevTop = el.scrollTop;
      void Promise.resolve(onLoadOlder()).finally(() => {
        fetchingOlderRef.current = false;
        requestAnimationFrame(() => {
          const el2 = scrollRef.current;
          if (el2) {
            el2.scrollTop = el2.scrollHeight - prevScrollHeight + prevTop;
          }
        });
      });
    }
  }, [hasMoreOlder, loadingOlder, onLoadOlder]);

  const handleSend = () => {
    onSend(draft);
    setDraft("");
  };

  const foreignTypers = (typingUserIds ?? []).filter((id) => !sameChatUserId(id, me?.id));

  return (
    <div
      className={cn(
        "pointer-events-auto flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-t-xl border border-border bg-card shadow-float",
        WINDOW_W,
        WINDOW_H,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/50 px-2 py-2">
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          {isGroup ? (
            <span className="text-xs font-bold text-primary">{title.trim().charAt(0).toUpperCase() || "N"}</span>
          ) : (
            <img src={avatarUrl || resolveAvatarUrl(null)} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
        </div>
        <button
          type="button"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => onMinimize(threadKey)}
          aria-label="Thu nhỏ"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => onClose(threadKey)}
          aria-label="Đóng"
        >
          <X className="size-4" />
        </button>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        data-local-scroll="true"
        className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-background/80 px-3 py-2"
      >
        {loadingOlder ? (
          <div className="flex justify-center py-1 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : null}
        {list.map((m, idx) => {
          const mine = me != null && sameChatUserId(m.senderId, me.id);
          const prev = idx > 0 ? list[idx - 1] : null;
          const sameRun = prev && prev.senderId === m.senderId;
          const showTime = !sameRun;
          return (
            <div key={String(m.id)} className={cn("flex flex-col gap-0.5", mine ? "items-end" : "items-start")}>
              {showTime ? (
                <span className="mb-0.5 text-[10px] text-muted-foreground">{formatMessageTime(m.createdAt)}</span>
              ) : null}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-1.5 text-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                {m.body}
              </div>
            </div>
          );
        })}
      </div>
      {foreignTypers.length > 0 ? (
        <div className="shrink-0 px-3 pb-1 text-xs italic text-muted-foreground">Đang nhập…</div>
      ) : null}
      <div className="shrink-0 border-t border-border bg-card p-2">
        <div className="flex items-end gap-1.5 rounded-xl border border-border bg-background px-2 py-1.5">
          <textarea
            rows={1}
            className="max-h-24 min-h-[2.25rem] w-full resize-none bg-transparent px-1 py-1 text-sm outline-none"
            placeholder="Nhập tin nhắn…"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              onTypingInput?.();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button type="button" size="sm" className="h-8 shrink-0 px-2" onClick={handleSend} aria-label="Gửi">
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function threadMeta(threadKey, conversations, userById) {
  const parsed = parseChatThreadKey(threadKey);
  if (!parsed) {
    return { title: "", avatarUrl: null, isGroup: false };
  }
  if (parsed.type === "direct") {
    const row = userById.get(parsed.id);
    const conv = conversations.find((c) => c.kind === "direct" && c.peerUserId === parsed.id);
    const title = row ? peerLabel(row) : conv?.peer ? peerLabel(conv.peer) : `Người dùng #${parsed.id}`;
    const raw = row?.profile?.avatarUrl || conv?.peer?.profile?.avatarUrl;
    return {
      title,
      avatarUrl: resolveAvatarUrl(raw),
      isGroup: false,
    };
  }
  const conv = conversations.find((c) => c.kind === "group" && c.groupId === parsed.id);
  return {
    title: conv?.name || `Nhóm #${parsed.id}`,
    avatarUrl: null,
    isGroup: true,
  };
}

export function MessengerChatDock() {
  const user = useCurrentUser();
  const {
    dock,
    messagesByThread,
    pickerOpen,
    setPickerOpen,
    groupModalOpen,
    setGroupModalOpen,
    hubOpen,
    setHubOpen,
    conversations,
    openDirectChat,
    openGroupChat,
    closeChat,
    minimizeChat,
    promoteFromQueue,
    sendText,
    createGroup,
    threadPaging,
    loadingOlderThread,
    loadOlderMessages,
    typingUsersByThread,
    emitTypingDebounced,
  } = useChatDock();

  const { data: users = [] } = useGetUsersQuery(undefined, { skip: !user?.id });

  const userById = useMemo(() => {
    const m = new Map();
    for (const u of users) {
      m.set(u.id, u);
    }
    return m;
  }, [users]);

  const [hubTab, setHubTab] = useState("all");
  const [hubSearch, setHubSearch] = useState("");

  useEffect(() => {
    if (!hubOpen) {
      setHubSearch("");
      setHubTab("all");
    }
  }, [hubOpen]);

  const handleCreateGroup = useCallback(
    async (payload) => {
      try {
        await createGroup(payload);
      } catch {
        /* createGroup throws from api */
      }
    },
    [createGroup],
  );

  if (!user?.id) {
    return null;
  }

  const [left, right] = dock.slots;
  const queue = dock.queue;

  return (
    <div className="print:hidden">
      <ChatHubPanel
        open={hubOpen}
        onClose={() => setHubOpen(false)}
        conversations={conversations}
        tab={hubTab}
        onTab={setHubTab}
        search={hubSearch}
        onSearch={setHubSearch}
        onPickDirect={(id) => {
          openDirectChat(id);
          setHubOpen(false);
        }}
        onPickGroup={(id) => {
          openGroupChat(id);
          setHubOpen(false);
        }}
        onNewDm={() => setPickerOpen(true)}
        onNewGroup={() => setGroupModalOpen(true)}
      />

      <ChatUserPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(id) => openDirectChat(id)}
      />

      <GroupCreateModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        onCreate={handleCreateGroup}
      />

      <div
        className="fixed bottom-0 right-3 z-[200] flex max-w-[calc(100vw-1rem)] flex-row items-end gap-3 sm:right-5 sm:gap-4"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="pointer-events-none flex min-w-0 flex-1 items-end justify-end gap-3 sm:gap-4">
        {right != null ? (
          <ChatWindowFrame
            threadKey={right}
            {...threadMeta(right, conversations, userById)}
            messages={messagesByThread[right]}
            onClose={closeChat}
            onMinimize={minimizeChat}
            onSend={(text) => sendText(right, text)}
            hasMoreOlder={threadPaging[right]?.hasMoreOlder ?? false}
            loadingOlder={Boolean(loadingOlderThread[right])}
            onLoadOlder={() => loadOlderMessages(right)}
            typingUserIds={[...(typingUsersByThread[right] ?? [])]}
            onTypingInput={() => emitTypingDebounced(right)}
          />
        ) : null}
        {left != null ? (
          <ChatWindowFrame
            threadKey={left}
            {...threadMeta(left, conversations, userById)}
            messages={messagesByThread[left]}
            onClose={closeChat}
            onMinimize={minimizeChat}
            onSend={(text) => sendText(left, text)}
            hasMoreOlder={threadPaging[left]?.hasMoreOlder ?? false}
            loadingOlder={Boolean(loadingOlderThread[left])}
            onLoadOlder={() => loadOlderMessages(left)}
            typingUserIds={[...(typingUsersByThread[left] ?? [])]}
            onTypingInput={() => emitTypingDebounced(left)}
          />
        ) : null}
        </div>

        <div
          className="pointer-events-auto flex w-12 shrink-0 flex-col items-center gap-2 pb-0.5"
          style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom, 0px))" }}
        >
          {queue.map((key) => {
            const meta = threadMeta(key, conversations, userById);
            return (
              <button
                key={key}
                type="button"
                className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-card shadow-md transition hover:ring-2 hover:ring-primary/30"
                onClick={() => promoteFromQueue(key)}
                title={meta.title}
              >
                {meta.isGroup ? (
                  <span className="text-sm font-bold text-primary">{meta.title.trim().charAt(0).toUpperCase()}</span>
                ) : meta.avatarUrl ? (
                  <img src={meta.avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  <MessageCircle className="size-5 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
