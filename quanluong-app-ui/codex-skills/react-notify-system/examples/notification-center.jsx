import { useSelector } from "react-redux";

import {
  selectNotifications,
  selectUnreadCount,
} from "../templates/notification-store";
import { NotificationBell } from "../templates/notification-bell";
import { NotificationItem } from "../templates/notification-item";

export const NotificationCenter = ({ onOpen, onRead }) => {
  const notifications = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);

  return (
    <div className="space-y-4">
      <NotificationBell unreadCount={unreadCount} onOpen={onOpen} />

      <div className="space-y-3">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onRead={onRead}
          />
        ))}
      </div>
    </div>
  );
};
