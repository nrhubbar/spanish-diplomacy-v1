import type { JSX } from "react";
import { Navigate, Route, Routes } from "react-router";
import { NotificationShelf } from "./notifications/NotificationShelf";
import { CounterScreen } from "./screens/CounterScreen";
import { StartScreen } from "./screens/StartScreen";

export function App(): JSX.Element {
  return (
    <>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/counter" element={<CounterScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <NotificationShelf />
    </>
  );
}
