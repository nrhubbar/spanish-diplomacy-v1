import type { JSX } from "react";
import { Navigate, Route, Routes } from "react-router";
import { NotificationShelf } from "./notifications/NotificationShelf";
import { OrderSubmissionScreen } from "./screens/OrderSubmissionScreen";
import { ResolutionScreen } from "./screens/ResolutionScreen";
import { GameOverScreen } from "./screens/GameOverScreen";
import { HandoffScreen } from "./screens/HandoffScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { StartScreen } from "./screens/StartScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

export function App(): JSX.Element {
  return (
    <>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/setup" element={<SetupScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/handoff" element={<HandoffScreen />} />
        <Route path="/orders" element={<OrderSubmissionScreen />} />
        <Route path="/resolution" element={<ResolutionScreen />} />
        <Route path="/game-over" element={<GameOverScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <NotificationShelf />
    </>
  );
}
