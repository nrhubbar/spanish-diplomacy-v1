import { type JSX, type ReactNode, useCallback, useEffect, useRef } from "react";
import type { FactionId, GameState, ScenarioId } from "../engine/types";
import { useAppDispatch, useAppSelector, useMapAssets, useScenarioPackage } from "../hooks";
import { CampaignMap } from "../map/CampaignMap";
import type { PaneContent } from "../map/MapPane";
import type { MapBriefing } from "../map/usePaneView";
import type { MapView } from "../map/view";
import { briefingAutoOpened } from "../state/briefingSlice";
import { mapLayersChosen } from "../state/mapLayersSlice";
import { addInfoNotification } from "../state/notificationSlice";
import { BriefingView } from "./BriefingView";

interface MapScreenFrameProps {
  /** The faction whose Briefing the "i" control shows. Without one, the map has no Briefing. */
  readonly briefingFor?: FactionId;
  readonly game: GameState;
  readonly header: ReactNode;
  readonly label: string;
  readonly pane: PaneContent;
  readonly scenarioId: ScenarioId;
  readonly view: MapView;
}

/** Full-width game layout: compact header, then the map with its in-map details pane. */
export function MapScreenFrame({ briefingFor, game, header, label, pane, scenarioId, view }: MapScreenFrameProps): JSX.Element {
  const dispatch = useAppDispatch();
  const scenarioPackage = useScenarioPackage(scenarioId);
  const assets = useMapAssets(scenarioId);
  const briefing = useBriefing(briefingFor, game, scenarioId, assets !== undefined);
  const layers = useAppSelector((state) => state.mapLayers.chosen);
  const notified = useRef(false);
  const onTerrainFallback = useCallback((reason: string) => {
    if (notified.current) return;
    notified.current = true;
    dispatch(addInfoNotification(reason));
  }, [dispatch]);

  return (
    <main aria-label={label} className="game-screen">
      {header}
      {assets === undefined ? (
        <div className="map-loading" role="status">Loading the map</div>
      ) : (
        <CampaignMap
          assets={assets}
          {...(briefing === undefined ? {} : { briefing })}
          game={game}
          layers={layers}
          onLayersChange={(chosen) => { dispatch(mapLayersChosen(chosen)); }}
          onTerrainFallback={onTerrainFallback}
          pane={pane}
          scenarioPackage={scenarioPackage}
          view={view}
        />
      )}
    </main>
  );
}

/**
 * The faction's Briefing. On turn 1 it opens by itself the first time this player's map
 * appears, and is then recorded so it never opens by itself again this game (B4).
 */
function useBriefing(factionId: FactionId | undefined, game: GameState, scenarioId: ScenarioId, mapShown: boolean): MapBriefing | undefined {
  const dispatch = useAppDispatch();
  const { scenario } = useScenarioPackage(scenarioId);
  const alreadyOpened = useAppSelector((state) => factionId !== undefined && state.briefing.autoOpenedFor.includes(factionId));
  const openOnStart = factionId !== undefined && game.turnNumber === 1 && !alreadyOpened;
  useEffect(() => {
    if (mapShown && openOnStart) dispatch(briefingAutoOpened(factionId));
  }, [dispatch, factionId, mapShown, openOnStart]);
  return factionId === undefined
    ? undefined
    : { body: <BriefingView factionId={factionId} scenario={scenario} state={game} />, openOnStart };
}
