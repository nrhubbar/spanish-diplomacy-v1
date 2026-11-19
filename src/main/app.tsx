import { type JSX, lazy, Suspense, useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAppDispatch, useSession } from "./hooks";
import { NotificationShelf } from "./notifications/NotificationShelf";
import { HandoffScreen } from "./screens/HandoffScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { StartScreen } from "./screens/StartScreen";
import { returnHome } from "./state/gameSlice";
import { addErrorNotification } from "./state/notificationSlice";
import { isPathAllowed, paths, routeForSession } from "./state/routing";
import { isInGame } from "./state/session";

const loadMapScreens = () => import("./screens/mapScreens");
const OrdersScreen = lazy(async () => ({ default: (await loadMapScreens()).OrdersScreen }));
const ResultsScreen = lazy(async () => ({ default: (await loadMapScreens()).ResultsScreen }));

/** Starts loading the map screens once a game is being set up, so play never waits on them. */
function usePrefetchMapScreens(): void {
  const phase = useSession().phase;
  useEffect(() => {
    if (phase !== "idle") void loadMapScreens();
  }, [phase]);
}

function MapLoading(): JSX.Element {
  return (
    <main aria-busy="true" className="screen card-screen">
      <p className="screen-copy" role="status">Loading the map...</p>
    </main>
  );
}

/** The single redirect point (R5): screens never decide where to go after a state change. */
function SessionGuard(): JSX.Element {
  const session = useSession();
  const location = useLocation();
  return isPathAllowed(session, location.pathname)
    ? <Outlet />
    : <Navigate replace to={routeForSession(session)} />;
}

/** OD-6: warn before a refresh or tab close discards a game in progress. */
function useLeaveWarning(): void {
  const inGame = isInGame(useSession());
  useEffect(() => {
    if (!inGame) return undefined;
    const warn = (event: BeforeUnloadEvent): void => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); };
  }, [inGame]);
}

export function App(): JSX.Element {
  const dispatch = useAppDispatch();
  useLeaveWarning();
  usePrefetchMapScreens();
  return (
    <>
      <ErrorBoundary onError={(message) => dispatch(addErrorNotification(message))} onReset={() => dispatch(returnHome())}>
        <Suspense fallback={<MapLoading />}>
          <Routes>
            <Route element={<SessionGuard />}>
              <Route element={<StartScreen />} path={paths.home} />
              <Route element={<SettingsScreen />} path={paths.settings} />
              <Route element={<SetupScreen />} path={paths.setup} />
              <Route element={<HandoffScreen />} path={paths.handoff} />
              <Route element={<OrdersScreen />} path={paths.orders} />
              <Route element={<ResultsScreen />} path={paths.resolution} />
              <Route element={<ResultsScreen />} path={paths.gameOver} />
              <Route element={<Navigate replace to={paths.home} />} path="*" />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <NotificationShelf />
    </>
  );
}
