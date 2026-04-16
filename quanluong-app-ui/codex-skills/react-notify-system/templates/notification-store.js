import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
};

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    setNotifications: (state, action) => {
      state.items = action.payload;
    },
    addNotification: (state, action) => {
      state.items.unshift(action.payload);
    },
    markAsRead: (state, action) => {
      const item = state.items.find(
        (notification) => notification.id === action.payload,
      );

      if (item) {
        item.isRead = true;
      }
    },
    markAllAsRead: (state) => {
      state.items.forEach((notification) => {
        notification.isRead = true;
      });
    },
    removeNotification: (state, action) => {
      state.items = state.items.filter(
        (notification) => notification.id !== action.payload,
      );
    },
  },
});

export const {
  addNotification,
  markAllAsRead,
  markAsRead,
  removeNotification,
  setNotifications,
} = notificationsSlice.actions;

export const notificationsReducer = notificationsSlice.reducer;

export const selectNotifications = (state) => state.notifications.items;
export const selectUnreadCount = (state) =>
  state.notifications.items.filter((notification) => !notification.isRead).length;
