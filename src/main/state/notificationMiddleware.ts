import { createListenerMiddleware, isRejected } from "@reduxjs/toolkit";
import { addErrorNotification } from "./notificationSlice";
import type { RootState } from "./store";

export const notificationMiddleware = createListenerMiddleware<RootState>();

notificationMiddleware.startListening({
  matcher: isRejected,
  effect: async (action, api) => {
    api.dispatch(addErrorNotification(action.error.message ?? "Unexpected application error."));
  }
});
