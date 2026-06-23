import type { JSX } from "react";
import { Navigate, Route, Routes } from "react-router";
import { NotificationShelf } from "./notifications/NotificationShelf";
import { OrderSubmissionScreen } from "./screens/OrderSubmissionScreen";
import { ResolutionScreen } from "./screens/ResolutionScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { StartScreen } from "./screens/StartScreen";

export function App(): JSX.Element {
  return (
    <>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/setup" element={<SetupScreen />} />
        <Route path="/orders" element={<OrderSubmissionScreen />} />
        <Route path="/resolution" element={<ResolutionScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <NotificationShelf />
    </>
  );
}
