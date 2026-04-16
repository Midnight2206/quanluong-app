export const NotificationItem = ({ notification, onRead }) => {
  return (
    <button
      type="button"
      className="w-full rounded-[var(--radius)] border bg-[hsl(var(--card))] p-4 text-left shadow-[var(--shadow-sm)]"
      onClick={() => onRead(notification.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium text-[hsl(var(--card-foreground))]">
            {notification.title}
          </p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {notification.message}
          </p>
        </div>
        {!notification.isRead ? (
          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[hsl(var(--primary))]" />
        ) : null}
      </div>
    </button>
  );
};
