import { createSlice, nanoid, type PayloadAction, type UnknownAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";

export type NotificationTone = "error" | "info" | "warning";

/** A button on a notification: what it says, and the action it dispatches. */
export interface NotificationAction {
  readonly label: string;
  readonly run: UnknownAction;
}

export interface AppNotification {
  readonly action?: NotificationAction;
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
  readonly action?: NotificationAction;
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
      prepare: ({ action, message, tone }: NotificationPayload) => ({
        payload: {
          ...(action === undefined ? {} : { action }),
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

export function selectNotifications(state: RootState): readonly AppNotification[] {
  return state.notifications.notifications;
}
