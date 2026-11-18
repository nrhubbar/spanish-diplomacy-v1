import { createContext, useContext, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { ScenarioId } from "./engine/types";
import type { ScenarioPackage } from "./scenarios/loader";
import type { MapAssets, ScenarioRegistry } from "./scenarios/registry";
import { loadMapAssets } from "./state/mapAssetsSlice";
import type { Phase, Session } from "./state/session";
import type { AppDispatch, RootState } from "./state/store";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

export const RegistryContext = createContext<ScenarioRegistry | undefined>(undefined);

export function useRegistry(): ScenarioRegistry {
  const registry = useContext(RegistryContext);
  if (registry === undefined) throw new Error("RegistryContext is missing.");
  return registry;
}

export function useSession(): Session {
  return useAppSelector((state) => state.game.session);
}

function inPhase<P extends Phase>(session: Session, phases: readonly P[]): session is Extract<Session, { readonly phase: P }> {
  const allowed: readonly Phase[] = phases;
  return allowed.includes(session.phase);
}

/**
 * The session for a screen that only renders in specific phases. The session guard routes
 * before screens render, so a mismatch is a programming error.
 */
export function useSessionIn<P extends Phase>(...phases: readonly P[]): Extract<Session, { readonly phase: P }> {
  const session = useSession();
  if (!inPhase(session, phases)) throw new Error(`Screen for ${phases.join("/")} rendered during ${session.phase}.`);
  return session;
}

export function useScenarioPackage(id: ScenarioId): ScenarioPackage {
  return useRegistry().require(id);
}

/** Starts loading a scenario's map assets and returns them once ready. */
export function useMapAssets(id: ScenarioId): MapAssets | undefined {
  const dispatch = useAppDispatch();
  const registry = useRegistry();
  const status = useAppSelector((state) => state.mapAssets.status[id]);
  useEffect(() => {
    void dispatch(loadMapAssets(id));
  }, [dispatch, id]);
  return status === "ready" ? registry.peekAssets(id) : undefined;
}
