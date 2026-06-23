import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";

export type NotificationTone = "error" | "info" | "warning";

export interface AppNotification {
  readonly id: string;
  readonly message: string;
  readonly tone: NotificationTone;
}

export interface NotificationState {
  readonly notifications: readonly AppNotification[];
}

const initialState: NotificationState = {
  notifications: []
};

interface NotificationPayload {
  readonly message: string;
  readonly tone: NotificationTone;
}

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    addNotification: {
      reducer: (state, action: PayloadAction<AppNotification>) => {
        state.notifications.push(action.payload);
      },
      prepare: ({ message, tone }: NotificationPayload) => ({
        payload: {
          id: nanoid(),
          message,
          tone
        }
      })
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload
      );
    }
  }
});

export const { addNotification, removeNotification } = notificationSlice.actions;
export const notificationReducer = notificationSlice.reducer;

export function addErrorNotification(message: string): ReturnType<typeof addNotification> {
  return addNotification({ message, tone: "error" });
}

export function addInfoNotification(message: string): ReturnType<typeof addNotification> {
  return addNotification({ message, tone: "info" });
}

export function addWarningNotification(message: string): ReturnType<typeof addNotification> {
  return addNotification({ message, tone: "warning" });
}

export function selectNotifications(state: RootState): readonly AppNotification[] {
  return state.notifications.notifications;
}
