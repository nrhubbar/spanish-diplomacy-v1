import type { JSX } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  removeNotification,
  selectNotifications,
  type NotificationAction,
  type NotificationTone
} from "../state/notificationSlice";

const toneLabels: Record<NotificationTone, string> = {
  error: "Error",
  info: "Info",
  warning: "Warning"
};

export function NotificationShelf(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(selectNotifications);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <aside className="notification-shelf" aria-label="Notifications" aria-live="polite">
      {notifications.map((notification) => (
        <article className={`notification notification-${notification.tone}`} key={notification.id}>
          <strong>{toneLabels[notification.tone]}</strong>
          <p>{notification.message}</p>
          {notification.action === undefined ? null : <NotificationButton action={notification.action} id={notification.id} />}
          <button type="button" onClick={() => dispatch(removeNotification(notification.id))}>
            Dismiss
          </button>
        </article>
      ))}
    </aside>
  );
}

/** Does what the notification offers, and closes it. */
function NotificationButton({ action, id }: { readonly action: NotificationAction; readonly id: string }): JSX.Element {
  const dispatch = useAppDispatch();
  return (
    <button
      onClick={() => {
        dispatch(action.run);
        dispatch(removeNotification(id));
      }}
      type="button"
    >
      {action.label}
    </button>
  );
}
