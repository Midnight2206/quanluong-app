export const NotificationBell = ({ unreadCount, onOpen }) => {
  return (
    <button
      type="button"
      className="relative rounded-full border bg-[hsl(var(--card))] p-2 text-[hsl(var(--card-foreground))] shadow-[var(--shadow-sm)]"
      onClick={onOpen}
    >
      <span>Bell</span>
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-[hsl(var(--destructive))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--destructive-foreground))]">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
};
